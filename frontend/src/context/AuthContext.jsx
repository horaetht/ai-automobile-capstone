import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getProfile, normalizeUsername } from '../services/profileService'
import { AuthContext } from './authContext'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  // Distinct from "profile is null/incomplete": profileError means we could
  // not determine profile state at all (network/Supabase failure), and must
  // never be treated as "no profile" -- that would wrongly send a user with
  // a perfectly good profile into onboarding just because a request failed.
  const [profileError, setProfileError] = useState(null)
  const isMounted = useRef(true)
  const profileRequestUserIdRef = useRef(null)

  useEffect(() => {
    isMounted.current = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted.current) return
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted.current) return
      setSession(newSession)
      setLoading(false)
    })

    return () => {
      isMounted.current = false
      subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user?.id ?? null

  useEffect(() => {
    const targetUserId = userId
    profileRequestUserIdRef.current = targetUserId

    const loadProfileForUser = async () => {
      if (!targetUserId) {
        setProfile(null)
        setProfileError(null)
        setProfileLoading(false)
        return
      }

      // Clear any profile carried over from a previous user before this
      // fetch resolves, so a slow/failed request can't leave a signed-in
      // user looking at someone else's cached profile.
      setProfile(null)
      setProfileError(null)
      setProfileLoading(true)
      try {
        const data = await getProfile(targetUserId)
        if (!isMounted.current || profileRequestUserIdRef.current !== targetUserId) return
        setProfile(data)
      } catch (err) {
        // A failed request is NOT "no profile" -- it's an unknown state.
        // Surface it via profileError and leave profile as-is (null here)
        // rather than asserting the user has no profile.
        if (!isMounted.current || profileRequestUserIdRef.current !== targetUserId) return
        setProfileError(err instanceof Error ? err.message : 'Failed to load your profile.')
      } finally {
        if (isMounted.current && profileRequestUserIdRef.current === targetUserId) {
          setProfileLoading(false)
        }
      }
    }

    loadProfileForUser()
  }, [userId])

  // Only ever invoked from event handlers (e.g. ProfileSetupPage after a
  // successful save, or the ProtectedRoute Retry action), never from an
  // effect, so it independently repeats the fetch-and-apply logic above
  // rather than sharing it. Unlike the auto-load effect, this does not clear
  // `profile` up front -- it's refreshing an already-loaded profile for the
  // same user, so a transient failure shouldn't blank out a value other
  // parts of the app (e.g. Header) may still be reading.
  const refreshProfile = useCallback(async () => {
    const targetUserId = userId
    profileRequestUserIdRef.current = targetUserId

    if (!targetUserId) {
      setProfile(null)
      setProfileError(null)
      setProfileLoading(false)
      return
    }

    setProfileLoading(true)
    setProfileError(null)
    try {
      const data = await getProfile(targetUserId)
      if (!isMounted.current || profileRequestUserIdRef.current !== targetUserId) return
      setProfile(data)
    } catch (err) {
      if (!isMounted.current || profileRequestUserIdRef.current !== targetUserId) return
      setProfileError(err instanceof Error ? err.message : 'Failed to load your profile.')
    } finally {
      if (isMounted.current && profileRequestUserIdRef.current === targetUserId) {
        setProfileLoading(false)
      }
    }
  }, [userId])

  const signUp = (email, password, profileDetails = {}) => {
    const firstName = typeof profileDetails.first_name === 'string' ? profileDetails.first_name.trim() : ''
    const lastName = typeof profileDetails.last_name === 'string' ? profileDetails.last_name.trim() : ''
    const username = normalizeUsername(profileDetails.username)
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()

    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username || undefined,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          full_name: fullName || undefined,
        },
      },
    })
  }
  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signOut = () => supabase.auth.signOut()

  // Mirrors profile data into auth user_metadata for convenience/consistency.
  // public.profiles remains the authoritative source that Header/HomePage
  // read from, so callers can treat this as best-effort.
  const updateAuthMetadata = (metadata) => supabase.auth.updateUser({ data: metadata })

  const value = {
    user: session?.user ?? null,
    session,
    loading,
    profile,
    profileLoading,
    profileError,
    refreshProfile,
    signUp,
    signIn,
    signOut,
    updateAuthMetadata,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

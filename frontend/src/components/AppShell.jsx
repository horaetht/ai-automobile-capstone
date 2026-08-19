import Sidebar from './Sidebar'

// Fixed dark sidebar + a single bright, centered content column. Every
// authenticated page renders its content as `children` here instead of
// stacking its own Header above a second navigation system.
function AppShell({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-shell-main">
        <div className="app-content">{children}</div>
      </main>
    </div>
  )
}

export default AppShell

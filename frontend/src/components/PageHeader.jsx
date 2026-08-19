// Small content-header replacement for the navigation-heavy Header that
// authenticated pages used before the sidebar existed -- title/subtitle
// only, no nav links, no account block (those now live in Sidebar).
function PageHeader({ title, subtitle }) {
  return (
    <div className="page-header">
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
  )
}

export default PageHeader

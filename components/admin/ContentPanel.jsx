import ContentEditor from "./ContentEditor";
export default function ContentPanel() {
  return (
    <section
      id="panel-content"
      className="admin-panel"
      role="tabpanel"
      aria-labelledby="tab-content"
      hidden
    >
      <ContentEditor />
    </section>
  );
}

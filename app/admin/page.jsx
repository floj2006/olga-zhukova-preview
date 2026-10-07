import "../../public/admin/admin.css";
import AdminMarkup from "../../components/admin/AdminMarkup";
import PageScripts from "../../components/PageScripts";
export const metadata = {
  title: "Управление сайтом",
  robots: { index: false, follow: false },
};
export default function AdminPage() {
  return (
    <>
      <AdminMarkup />
      <PageScripts admin />
    </>
  );
}

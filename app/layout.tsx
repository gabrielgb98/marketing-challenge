import "./style.css";
export const metadata = {
  title: "ClassRush · Tu clase en juego",
  description:
    "Cuestionarios y competencias interactivas por equipos para cualquier materia.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

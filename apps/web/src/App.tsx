import { MusicBingoWeb } from "./apps/musicbingo";
import { ToastMachineWeb } from "./apps/toastmachine";

function App() {
  const path = window.location.pathname;
  if (path.startsWith("/musicbingo/play")) {
    return <MusicBingoWeb />;
  }
  if (path.startsWith("/toastmachine/play")) {
    return <ToastMachineWeb />;
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-4 text-center">
      <div>
        <h1 className="text-2xl font-bold">EventSoft Web</h1>
        <p className="mt-2 text-indigo-200/60">
          Перейдите по ссылке /musicbingo/play или /toastmachine/play
        </p>
      </div>
    </div>
  );
}

export default App;

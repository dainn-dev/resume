export default function PortfolioNotFound() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-6xl font-bold text-gray-700">404</h1>
      <p className="mt-4 text-gray-400">This portfolio doesn’t exist or isn’t published yet.</p>
      <a
        href="https://dresume.dainn.online"
        className="mt-6 text-sm text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline"
      >
        Create your own at DResume
      </a>
    </div>
  );
}

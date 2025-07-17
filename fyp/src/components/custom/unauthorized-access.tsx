export default function UnauthorizedAccess({
    message = "You do not have permission to view this page.",
}: {
    message?: string;
}) {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <h1 className="text-4xl font-bold text-red-600 mb-4">Access Denied</h1>
                <p className="text-lg text-gray-700">{message}</p>
            </div>
        </div>
    );
}

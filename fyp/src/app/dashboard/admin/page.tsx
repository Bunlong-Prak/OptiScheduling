import { AdminManagement } from "../../../components/custom/admin-management";

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">System Settings</h1>
                <p className="text-gray-500">
                    Manage administrators and system configuration
                </p>
            </div>

            <AdminManagement />
        </div>
    );
}

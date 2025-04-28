import { getAuthUser } from "@/auth/server/action";
import Dashboard from "./client";

export default async function DashboardPage() {
    const user = await getAuthUser();

    if (!user) {
        return <div>Unauthorized</div>;
    }

    return <Dashboard authUser={user} />;
}

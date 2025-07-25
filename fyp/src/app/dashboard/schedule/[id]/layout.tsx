import { getAuthUser } from "@/auth/server/action";
import UnauthorizedAccess from "@/components/custom/unauthorized-access";
import { PropsWithChildren } from "react";
import ScheduleLayoutClient from "./client_layout";

interface ScheduleLayoutProps {
    params: Promise<{ id: string }>;
}

export default async function ScheduleLayout({
    params,
    children,
}: PropsWithChildren<ScheduleLayoutProps>) {
    const user = await getAuthUser();
    const { id: scheduleId } = await params;

    if (!user) {
        return <UnauthorizedAccess message="You must be logged in." />;
    }

    const ownershipRes = await fetch(
        `${process.env.DOMAIN}/api/schedules/ownership?scheduleId=${scheduleId}&userId=${user.id}`,
        { cache: "no-store" }
    );
    const ownership = await ownershipRes.json();

    if (!ownership?.owner) {
        return (
            <UnauthorizedAccess message="You do not have permission to access this schedule." />
        );
    }

    return <ScheduleLayoutClient>{children}</ScheduleLayoutClient>;
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#1a1744] to-[#0f0c29]">
            {children}
        </div>
    );
}

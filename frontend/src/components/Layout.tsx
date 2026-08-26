import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/schedule": "Schedule",
  "/conflicts": "Conflicts",
  "/replan": "Replan",
  "/metrics": "Metrics",
};

export default function Layout() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? "";

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <span className="text-sm font-medium">{title}</span>
          </header>
          <div className="viz-root flex flex-1 flex-col gap-4 p-4 md:p-6">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  Shuffle,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Schedule", url: "/schedule", icon: CalendarDays },
  { title: "Conflicts", url: "/conflicts", icon: AlertTriangle },
  { title: "Replan", url: "/replan", icon: Shuffle },
  { title: "Metrics", url: "/metrics", icon: BarChart3 },
];

export function AppSidebar() {
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm shrink-0">
            PW
          </div>
          <span className="font-semibold text-sm truncate group-data-[collapsible=icon]:hidden">
            Placement Week Scheduler
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Coordinator</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

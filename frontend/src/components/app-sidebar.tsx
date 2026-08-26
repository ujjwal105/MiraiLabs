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
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm shrink-0">
            PS
          </div>
          <span className="font-semibold text-sm truncate group-data-[collapsible=icon]:hidden">
            Placement Scheduler
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Coordinator</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {NAV_ITEMS.map((item) => {
                const isActive = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      size="lg"
                      className="gap-3 group-data-[collapsible=icon]:justify-center [&_svg]:size-5"
                    >
                      <Link to={item.url}>
                        <item.icon />
                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
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

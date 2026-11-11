// The Lucide icons the site uses, by the design system's kebab-case names.
// The kit renders any Lucide name from the UMD bundle; here each one is
// imported by name so a page ships only the icons it can draw. Add a line
// when a page needs a new icon.
import {
  Apple, ArrowRight, ArrowUpRight, Asterisk, BadgeCheck, Ban, Bell, Calendar, CalendarDays, CalendarX, Check,
  ChevronDown, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Clock, Crown, DoorOpen, Flag, Footprints,
  Gauge, Hourglass, Image, Instagram, LayoutDashboard, LayoutGrid, LocateFixed, Lock, LogIn, LogOut, Mail,
  Map as MapIcon, MapPin, MapPinned, Megaphone, Menu, MessageCircleQuestion, Minus, Moon, Mouse, Navigation,
  Newspaper, Play, Plus, Repeat, Route, ScanLine, Search, SearchX, Settings, ShieldCheck, Smartphone, Star,
  Sunrise, Ticket, UserRound, UsersRound, WifiOff, X, type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  apple: Apple, "arrow-right": ArrowRight, "arrow-up-right": ArrowUpRight, asterisk: Asterisk,
  "badge-check": BadgeCheck, ban: Ban, bell: Bell, calendar: Calendar, "calendar-days": CalendarDays,
  "calendar-x": CalendarX, check: Check, "chevron-down": ChevronDown, "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight, "circle-alert": CircleAlert, "circle-check": CircleCheck, clock: Clock,
  crown: Crown, "door-open": DoorOpen, flag: Flag, footprints: Footprints, gauge: Gauge, hourglass: Hourglass,
  image: Image, instagram: Instagram, "layout-dashboard": LayoutDashboard, "layout-grid": LayoutGrid,
  "locate-fixed": LocateFixed, lock: Lock, "log-in": LogIn, "log-out": LogOut, mail: Mail, map: MapIcon,
  "map-pin": MapPin, "map-pinned": MapPinned, megaphone: Megaphone, menu: Menu,
  "message-circle-question": MessageCircleQuestion, minus: Minus, moon: Moon, mouse: Mouse, navigation: Navigation,
  newspaper: Newspaper, play: Play, plus: Plus, repeat: Repeat, route: Route, "scan-line": ScanLine, search: Search,
  "search-x": SearchX, settings: Settings, "shield-check": ShieldCheck, smartphone: Smartphone, star: Star,
  sunrise: Sunrise, ticket: Ticket, "user-round": UserRound, "users-round": UsersRound, "wifi-off": WifiOff, x: X,
};

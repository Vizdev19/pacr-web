// The Lucide icons the site uses, by the design system's kebab-case names.
// The kit renders any Lucide name from the UMD bundle; here each one is
// imported by name so a page ships only the icons it can draw. Add a line
// when a page needs a new icon.
import {
  Activity, Apple, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Asterisk, AtSign, Award, BadgeCheck, Ban,
  Bell, BellOff, BookOpen, Building2, Calendar, CalendarCheck, CalendarDays, CalendarPlus, CalendarX, Camera,
  ChartLine, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleAlert, CircleCheck,
  CircleHelp, CircleUserRound, Clock, Compass, Copy, Crown, DoorOpen, Download, Ellipsis, EllipsisVertical,
  ExternalLink, Eye, EyeOff, FileText, Flag, Flame, Footprints, Gauge, Globe, Handshake, Hash, Heart, HeartPulse,
  Hourglass, House, Image, IndianRupee, Info, Instagram, KeyRound, LayoutDashboard, LayoutGrid, Link, ListOrdered,
  LocateFixed, Lock, LogIn, LogOut, Mail, Map as MapIcon, MapPin, MapPinned, Medal, Megaphone, Menu, MessageCircle,
  MessageCircleQuestion, MessagesSquare, Minus, Moon, Mountain, Mouse, Navigation, Newspaper, Pencil, Pin, Play,
  Plus, QrCode, RefreshCw, Repeat, Reply, Route, Scale, ScanLine, Search, SearchX, SendHorizontal, Settings, Share2,
  ShieldAlert, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles, Star, Sun, Sunrise, Tag, Ticket, Timer, Trash2,
  TriangleAlert, Trophy, Undo2, UserCheck, UserPlus, UserRound, UserX, Users, UsersRound, VolumeX, Wallet, Watch,
  WifiOff, X, Zap, type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  activity: Activity, apple: Apple, "arrow-down-right": ArrowDownRight, "arrow-left": ArrowLeft, "arrow-right": ArrowRight,
  "arrow-up-right": ArrowUpRight, asterisk: Asterisk, "at-sign": AtSign, award: Award, "badge-check": BadgeCheck, ban: Ban,
  bell: Bell, "bell-off": BellOff, "book-open": BookOpen, "building-2": Building2, calendar: Calendar,
  "calendar-check": CalendarCheck, "calendar-days": CalendarDays, "calendar-plus": CalendarPlus, "calendar-x": CalendarX,
  camera: Camera, "chart-line": ChartLine, check: Check, "check-check": CheckCheck, "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft, "chevron-right": ChevronRight, "chevron-up": ChevronUp, "circle-alert": CircleAlert,
  "circle-check": CircleCheck, "circle-help": CircleHelp, "circle-user-round": CircleUserRound, clock: Clock,
  compass: Compass, copy: Copy, crown: Crown, "door-open": DoorOpen, download: Download, ellipsis: Ellipsis,
  "ellipsis-vertical": EllipsisVertical, "external-link": ExternalLink, eye: Eye, "eye-off": EyeOff, "file-text": FileText,
  flag: Flag, flame: Flame, footprints: Footprints, gauge: Gauge, globe: Globe, handshake: Handshake, hash: Hash,
  heart: Heart, "heart-pulse": HeartPulse, hourglass: Hourglass, house: House, image: Image, "indian-rupee": IndianRupee,
  info: Info, instagram: Instagram, "key-round": KeyRound, "layout-dashboard": LayoutDashboard, "layout-grid": LayoutGrid,
  link: Link, "list-ordered": ListOrdered, "locate-fixed": LocateFixed, lock: Lock, "log-in": LogIn, "log-out": LogOut,
  mail: Mail, map: MapIcon, "map-pin": MapPin, "map-pinned": MapPinned, medal: Medal, megaphone: Megaphone, menu: Menu,
  "message-circle": MessageCircle, "message-circle-question": MessageCircleQuestion, "messages-square": MessagesSquare,
  minus: Minus, moon: Moon, mountain: Mountain, mouse: Mouse, navigation: Navigation, newspaper: Newspaper, pencil: Pencil,
  pin: Pin, play: Play, plus: Plus, "qr-code": QrCode, "refresh-cw": RefreshCw, repeat: Repeat, reply: Reply, route: Route,
  scale: Scale, "scan-line": ScanLine, search: Search, "search-x": SearchX, "send-horizontal": SendHorizontal,
  settings: Settings, "share-2": Share2, "shield-alert": ShieldAlert, "shield-check": ShieldCheck,
  "sliders-horizontal": SlidersHorizontal, smartphone: Smartphone, sparkles: Sparkles, star: Star, sun: Sun,
  sunrise: Sunrise, tag: Tag, ticket: Ticket, timer: Timer, "trash-2": Trash2, "triangle-alert": TriangleAlert,
  trophy: Trophy, "undo-2": Undo2, "user-check": UserCheck, "user-plus": UserPlus, "user-round": UserRound,
  "user-x": UserX, users: Users, "users-round": UsersRound, "volume-x": VolumeX, wallet: Wallet, watch: Watch,
  "wifi-off": WifiOff, x: X, zap: Zap,
};

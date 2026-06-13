const BASE = "/api";

export function getBpToken(): string | null {
  return localStorage.getItem("bp_token");
}

export function setBpToken(token: string): void {
  localStorage.setItem("bp_token", token);
}

export function clearBpToken(): void {
  localStorage.removeItem("bp_token");
  localStorage.removeItem("fb_user");
}

export interface BpUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  role: string;
  status: string;
  createdAt: string;
}

async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = getBpToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401 && token) {
    clearBpToken();
    window.dispatchEvent(new CustomEvent("bp:session-expired"));
  }
  return res;
}

export async function apiLogin(email: string, password: string): Promise<{ token: string; user: BpUser }> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Identifiants incorrects");
  }
  return res.json() as Promise<{ token: string; user: BpUser }>;
}

export async function apiRegister(data: {
  firstName: string; lastName: string; email: string;
  phone: string; password: string; country: string;
}): Promise<{ token: string; user: BpUser }> {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Erreur lors de l'inscription");
  }
  return res.json() as Promise<{ token: string; user: BpUser }>;
}

export async function apiGetMe(): Promise<BpUser> {
  const res = await apiFetch("/users/me");
  if (!res.ok) throw new Error("Non authentifié");
  return res.json() as Promise<BpUser>;
}

export async function apiUpdateMe(data: Partial<{
  firstName: string; lastName: string; phone: string;
  country: string; bio: string; avatarUrl: string; coverUrl: string;
}>): Promise<BpUser> {
  const res = await apiFetch("/users/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Mise à jour échouée");
  return res.json() as Promise<BpUser>;
}

export interface FeedPost {
  id: number;
  authorId: number;
  authorName: string;
  authorAvatarUrl: string | null;
  authorCountry: string;
  content: string;
  imageUrl: string | null;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  liked: boolean;
}

export interface PublicUser {
  id: number;
  firstName: string;
  lastName: string;
  country: string | null;
  avatarUrl: string | null;
  bio: string | null;
}

export type FriendshipStatus = "none" | "pending_sent" | "pending_received" | "friends";

export interface PublicUserWithStatus extends PublicUser {
  friendshipStatus: FriendshipStatus;
  requestId?: number;
}

export interface FriendRequest {
  id: number;
  createdAt: string;
  fromUser: PublicUser;
}

export async function apiGetUsers(): Promise<PublicUser[]> {
  const res = await apiFetch("/users");
  if (!res.ok) return [];
  return res.json() as Promise<PublicUser[]>;
}

export async function apiGetUsersWithStatus(): Promise<PublicUserWithStatus[]> {
  const res = await apiFetch("/users");
  if (!res.ok) return [];
  return res.json() as Promise<PublicUserWithStatus[]>;
}

export async function apiSearchUsers(q: string, options?: { country?: string }): Promise<PublicUserWithStatus[]> {
  if (!q.trim()) return [];
  const params = new URLSearchParams({ q: q.trim() });
  if (options?.country) params.set("country", options.country);
  const res = await apiFetch(`/users?${params.toString()}`);
  if (!res.ok) return [];
  return res.json() as Promise<PublicUserWithStatus[]>;
}

export async function apiGetFriends(): Promise<PublicUser[]> {
  const res = await apiFetch("/users/me/friends");
  if (!res.ok) return [];
  return res.json() as Promise<PublicUser[]>;
}

export async function apiGetFriendRequests(): Promise<FriendRequest[]> {
  const res = await apiFetch("/users/me/friend-requests");
  if (!res.ok) return [];
  return res.json() as Promise<FriendRequest[]>;
}

export async function apiSendFriendRequest(userId: number): Promise<{ id: number; status: string }> {
  const res = await apiFetch(`/users/${userId}/friend-request`, { method: "POST" });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: string; requestId?: number; status?: string };
    if (res.status === 409) return { id: e.requestId ?? 0, status: e.status ?? "pending" };
    throw new Error(e.error ?? "Erreur");
  }
  return res.json() as Promise<{ id: number; status: string }>;
}

export async function apiAcceptFriendRequest(requestId: number): Promise<void> {
  const res = await apiFetch(`/friends/${requestId}/accept`, { method: "POST" });
  if (!res.ok) throw new Error("Erreur");
}

export async function apiRejectFriendRequest(requestId: number): Promise<void> {
  const res = await apiFetch(`/friends/${requestId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erreur");
}

export async function apiBlockUser(userId: number): Promise<void> {
  const res = await apiFetch(`/users/${userId}/block`, { method: "POST" });
  if (!res.ok) throw new Error("Erreur lors du blocage");
}

export async function apiUnblockUser(userId: number): Promise<void> {
  const res = await apiFetch(`/users/${userId}/block`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erreur lors du déblocage");
}

export interface BlockedUser {
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export async function apiGetBlockedUsers(): Promise<BlockedUser[]> {
  const res = await apiFetch("/users/me/blocks");
  if (!res.ok) throw new Error("Erreur lors du chargement des utilisateurs bloqués");
  return res.json() as Promise<BlockedUser[]>;
}

export async function apiCheckBlock(userId: number): Promise<boolean> {
  const res = await apiFetch(`/users/${userId}/block`);
  if (!res.ok) return false;
  const data = await res.json() as { blocked: boolean };
  return data.blocked;
}

export async function apiReportUser(userId: number, reason: string): Promise<void> {
  const res = await apiFetch(`/users/${userId}/report`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error("Erreur lors du signalement");
}

export async function apiGetPosts(page = 1): Promise<FeedPost[]> {
  const res = await apiFetch(`/posts?page=${page}`);
  if (!res.ok) return [];
  return res.json() as Promise<FeedPost[]>;
}

export async function apiSearchPosts(search: string): Promise<FeedPost[]> {
  if (!search.trim()) return [];
  const res = await apiFetch(`/posts?search=${encodeURIComponent(search.trim())}`);
  if (!res.ok) return [];
  return res.json() as Promise<FeedPost[]>;
}

export interface ApiGroup {
  id: number;
  name: string;
  description: string | null;
  category: string;
  emoji: string;
  coverUrl: string | null;
  country: string | null;
  privacy: string;
  membersCount: number;
  createdAt: string;
  isMember?: boolean;
}

export interface ApiGroupDetail extends ApiGroup {
  isMember: boolean;
  memberRole: string | null;
}

export async function apiGetGroups(): Promise<ApiGroup[]> {
  const res = await apiFetch("/groups");
  if (!res.ok) return [];
  return res.json() as Promise<ApiGroup[]>;
}

export async function apiSearchGroups(search: string, options?: { country?: string; category?: string }): Promise<ApiGroup[]> {
  if (!search.trim()) return [];
  const params = new URLSearchParams({ search: search.trim() });
  if (options?.country) params.set("country", options.country);
  if (options?.category) params.set("category", options.category);
  const res = await apiFetch(`/groups?${params.toString()}`);
  if (!res.ok) return [];
  return res.json() as Promise<ApiGroup[]>;
}

export async function apiGetGroup(id: number): Promise<ApiGroupDetail> {
  const res = await apiFetch(`/groups/${id}`);
  if (!res.ok) throw new Error("Groupe introuvable");
  return res.json() as Promise<ApiGroupDetail>;
}

export async function apiJoinGroup(id: number): Promise<void> {
  const res = await apiFetch(`/groups/${id}/join`, { method: "POST" });
  if (!res.ok) throw new Error("Impossible de rejoindre le groupe");
}

export async function apiLeaveGroup(id: number): Promise<void> {
  const res = await apiFetch(`/groups/${id}/leave`, { method: "DELETE" });
  if (!res.ok) throw new Error("Impossible de quitter le groupe");
}

export interface ApiGroupPost {
  id: number;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  authorId: number;
  authorFirstName: string;
  authorLastName: string;
  authorAvatarUrl: string | null;
}

export async function apiGetGroupPosts(groupId: number): Promise<ApiGroupPost[]> {
  const res = await apiFetch(`/groups/${groupId}/posts`);
  if (!res.ok) return [];
  return res.json() as Promise<ApiGroupPost[]>;
}

export async function apiCreateGroupPost(groupId: number, content: string, imageUrl?: string): Promise<void> {
  const res = await apiFetch(`/groups/${groupId}/posts`, {
    method: "POST",
    body: JSON.stringify({ content, imageUrl: imageUrl ?? null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Impossible de publier dans ce groupe");
  }
}

export async function apiCreatePost(
  content: string,
  imageUrl?: string,
  thumbnailUrl?: string,
): Promise<void> {
  await apiFetch("/posts", {
    method: "POST",
    body: JSON.stringify({
      content,
      imageUrl: imageUrl ?? null,
      thumbnailUrl: thumbnailUrl ?? null,
    }),
  });
}

export async function apiLikePost(id: number, action: "like" | "unlike"): Promise<void> {
  await apiFetch(`/posts/${id}/like`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export function saveFbUser(user: BpUser): void {
  const COUNTRY_FLAGS: Record<string, string> = {
    CI: "🇨🇮", SN: "🇸🇳", BJ: "🇧🇯", TG: "🇹🇬", BF: "🇧🇫", NE: "🇳🇪",
    ML: "🇲🇱", GN: "🇬🇳", CM: "🇨🇲", TD: "🇹🇩", GA: "🇬🇦", CG: "🇨🇬",
    CD: "🇨🇩", CF: "🇨🇫", GH: "🇬🇭",
  };
  localStorage.setItem("fb_user", JSON.stringify({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    phone: user.phone,
    country: user.country,
    countryCode: user.country,
    flag: COUNTRY_FLAGS[user.country] ?? "🌍",
    avatarUrl: user.avatarUrl ?? "",
    coverUrl: user.coverUrl ?? "",
    bio: user.bio ?? "",
  }));
}

// ── Stories ──────────────────────────────────────────────────────────────────

export interface StoryItem {
  id: number;
  mediaUrl: string | null;
  content: string | null;
  bgColor: string;
  emoji: string | null;
  expiresAt: string;
  viewsCount: number;
  createdAt: string;
}

export interface StoryGroup {
  authorId: number;
  authorName: string;
  authorAvatarUrl: string | null;
  authorCountry: string;
  storiesCount: number;
  stories: StoryItem[];
  latestStoryAt: string | null;
}

export async function apiGetStories(): Promise<StoryGroup[]> {
  const res = await apiFetch("/stories");
  if (!res.ok) return [];
  return res.json() as Promise<StoryGroup[]>;
}

export async function apiCreateStory(data: {
  mediaUrl?: string;
  thumbnailUrl?: string;
  content?: string;
  bgColor?: string;
  emoji?: string;
}): Promise<void> {
  const res = await apiFetch("/stories", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Erreur création story");
  }
}

export async function apiViewStory(id: number): Promise<void> {
  await apiFetch(`/stories/${id}/view`, { method: "POST" });
}

export async function apiDeleteStory(id: number): Promise<void> {
  await apiFetch(`/stories/${id}`, { method: "DELETE" });
}

// ── Wallet ───────────────────────────────────────────────────────────────────

export interface ApiWallet {
  id: number;
  userId: number;
  balance: number;
  currency: string;
}

export interface ApiTx {
  id: number;
  type: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  fromUserId: number | null;
  toUserId: number | null;
  createdAt: string;
}

export async function apiGetWallet(): Promise<ApiWallet> {
  const res = await apiFetch("/wallet");
  if (!res.ok) throw new Error("Wallet non disponible");
  return res.json() as Promise<ApiWallet>;
}

export async function apiGetTransactions(): Promise<ApiTx[]> {
  const res = await apiFetch("/wallet/transactions");
  if (!res.ok) return [];
  return res.json() as Promise<ApiTx[]>;
}

export async function apiDeposit(amount: number, operator: string, phone: string): Promise<ApiTx> {
  const res = await apiFetch("/wallet/deposit", {
    method: "POST",
    body: JSON.stringify({ amount, currency: "XOF", operator, phone }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})) as { error?: string }; throw new Error(e.error ?? "Dépôt échoué"); }
  return res.json() as Promise<ApiTx>;
}

export async function apiTransfer(toUserId: number, amount: number, description?: string): Promise<ApiTx> {
  const res = await apiFetch("/wallet/transfer", {
    method: "POST",
    body: JSON.stringify({ toUserId, amount, currency: "XOF", description }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})) as { error?: string }; throw new Error(e.error ?? "Transfert échoué"); }
  return res.json() as Promise<ApiTx>;
}

// ── Tontines ─────────────────────────────────────────────────────────────────

export interface ApiTontine {
  id: number;
  name: string;
  description: string | null;
  contributionAmount: number;
  cycle: string;
  currency: string;
  status: string;
  nextContributionDate: string | null;
  createdById: number;
  membersCount: number;
  createdAt: string;
}

export async function apiGetTontines(): Promise<ApiTontine[]> {
  const res = await apiFetch("/tontines");
  if (!res.ok) return [];
  return res.json() as Promise<ApiTontine[]>;
}

export async function apiGetOpenTontines(): Promise<ApiTontine[]> {
  const res = await apiFetch("/tontines?scope=open");
  if (!res.ok) return [];
  return res.json() as Promise<ApiTontine[]>;
}

export async function apiCreateTontine(data: { name: string; contributionAmount: number; cycle: string }): Promise<ApiTontine> {
  const res = await apiFetch("/tontines", {
    method: "POST",
    body: JSON.stringify({ ...data, currency: "XOF" }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})) as { error?: string }; throw new Error(e.error ?? "Création échouée"); }
  return res.json() as Promise<ApiTontine>;
}

export async function apiJoinTontine(id: number): Promise<void> {
  await apiFetch(`/tontines/${id}/members`, { method: "POST", body: JSON.stringify({}) });
}

export async function apiContribute(tontineId: number, amount: number): Promise<void> {
  await apiFetch(`/tontines/${tontineId}/contribute`, {
    method: "POST",
    body: JSON.stringify({ amount, currency: "XOF" }),
  });
}

// ── Messages ─────────────────────────────────────────────────────────────────

export interface ApiConversation {
  userId: number;
  lastMessage: string;
  unreadCount: number;
  updatedAt: string;
}

export interface ApiChatMessage {
  id: number;
  fromUserId: number;
  toUserId: number;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export async function apiGetConversations(): Promise<ApiConversation[]> {
  const res = await apiFetch("/messages");
  if (!res.ok) return [];
  return res.json() as Promise<ApiConversation[]>;
}

export async function apiGetMessages(userId: number): Promise<ApiChatMessage[]> {
  const res = await apiFetch(`/messages/${userId}`);
  if (!res.ok) return [];
  return res.json() as Promise<ApiChatMessage[]>;
}

export async function apiSendMessage(toUserId: number, content: string): Promise<ApiChatMessage> {
  const res = await apiFetch("/messages", {
    method: "POST",
    body: JSON.stringify({ toUserId, content }),
  });
  if (!res.ok) throw new Error("Envoi échoué");
  return res.json() as Promise<ApiChatMessage>;
}

export async function apiGetUserPosts(userId: number): Promise<FeedPost[]> {
  const res = await apiFetch(`/posts?authorId=${userId}`);
  if (!res.ok) return [];
  return res.json() as Promise<FeedPost[]>;
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export interface ApiJob {
  id: number;
  title: string;
  company: string;
  description: string | null;
  location: string;
  type: string;
  salary: number | null;
  currency: string;
  status: string;
  skills: string | null;
  createdAt: string;
}

export async function apiGetJobs(params?: { type?: string; search?: string; country?: string }): Promise<ApiJob[]> {
  const q = new URLSearchParams();
  if (params?.type) q.set("type", params.type);
  if (params?.search) q.set("search", params.search);
  if (params?.country) q.set("country", params.country);
  const qs = q.toString();
  const res = await apiFetch(`/jobs${qs ? `?${qs}` : ""}`);
  if (!res.ok) return [];
  return res.json() as Promise<ApiJob[]>;
}

export async function apiGetJob(id: number): Promise<ApiJob | null> {
  const res = await apiFetch(`/jobs/${id}`);
  if (!res.ok) return null;
  return res.json() as Promise<ApiJob>;
}

export async function apiApplyToJob(id: number, data: { coverLetter?: string; cvUrl?: string }): Promise<void> {
  const res = await apiFetch(`/jobs/${id}/apply`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(e.error ?? "Candidature échouée");
  }
}

export async function apiCreateJob(data: {
  title: string; company: string; type: string; location: string;
  salary?: number; currency?: string; description?: string;
}): Promise<ApiJob> {
  const res = await apiFetch("/jobs", { method: "POST", body: JSON.stringify(data) });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(e.error ?? "Erreur lors de la création");
  }
  return res.json() as Promise<ApiJob>;
}

// ── Education ─────────────────────────────────────────────────────────────────

export interface ApiCourse {
  id: number;
  title: string;
  description: string | null;
  category: string;
  level: string;
  duration: number;
  isFree: boolean;
  price: number | null;
  currency: string | null;
  instructorId: number;
  enrollmentsCount: number;
  createdAt: string;
}

export interface ApiLesson {
  id: number;
  courseId: number;
  title: string;
  content: string | null;
  duration: number;
  order: number;
}

export interface ApiEnrollment {
  id: number;
  courseId: number;
  userId: number;
  progress: number;
  status: string;
  enrolledAt: string;
}

export async function apiGetCourses(params?: { category?: string; level?: string }): Promise<ApiCourse[]> {
  const q = new URLSearchParams();
  if (params?.category) q.set("category", params.category);
  if (params?.level) q.set("level", params.level);
  const qs = q.toString();
  const res = await apiFetch(`/courses${qs ? `?${qs}` : ""}`);
  if (!res.ok) return [];
  return res.json() as Promise<ApiCourse[]>;
}

export async function apiGetCourse(id: number): Promise<(ApiCourse & { lessons: ApiLesson[] }) | null> {
  const res = await apiFetch(`/courses/${id}`);
  if (!res.ok) return null;
  return res.json() as Promise<ApiCourse & { lessons: ApiLesson[] }>;
}

export async function apiGetEnrollments(): Promise<ApiEnrollment[]> {
  const res = await apiFetch("/enrollments");
  if (!res.ok) return [];
  return res.json() as Promise<ApiEnrollment[]>;
}

export async function apiEnrollCourse(id: number): Promise<ApiEnrollment> {
  const res = await apiFetch(`/courses/${id}/enroll`, { method: "POST", body: JSON.stringify({}) });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(e.error ?? "Inscription échouée");
  }
  return res.json() as Promise<ApiEnrollment>;
}

export async function apiUpdateEnrollmentProgress(courseId: number, progress: number): Promise<void> {
  await apiFetch(`/enrollments/${courseId}`, {
    method: "PATCH",
    body: JSON.stringify({ progress }),
  });
}

// ── Marketplace ───────────────────────────────────────────────────────────────

export interface ApiProduct {
  id: number;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  category: string;
  imageUrl: string | null;
  status: string;
  sellerId: number;
  location: string | null;
  createdAt: string;
}

export async function apiGetProducts(params?: { category?: string; search?: string; country?: string }): Promise<ApiProduct[]> {
  const q = new URLSearchParams();
  if (params?.category) q.set("category", params.category);
  if (params?.search) q.set("search", params.search);
  if (params?.country) q.set("country", params.country);
  const qs = q.toString();
  const res = await apiFetch(`/products${qs ? `?${qs}` : ""}`);
  if (!res.ok) return [];
  return res.json() as Promise<ApiProduct[]>;
}

export async function apiGetProduct(id: number): Promise<ApiProduct | null> {
  const res = await apiFetch(`/products/${id}`);
  if (!res.ok) return null;
  return res.json() as Promise<ApiProduct>;
}

export async function apiCreateProduct(data: {
  title: string; description?: string; price: number;
  currency?: string; category: string; imageUrl?: string; location?: string;
}): Promise<ApiProduct> {
  const res = await apiFetch("/products", { method: "POST", body: JSON.stringify(data) });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(e.error ?? "Erreur lors de la création");
  }
  return res.json() as Promise<ApiProduct>;
}

// ── Gifts & Tokens ────────────────────────────────────────────────────────────

export interface ApiGiftItem {
  id: number;
  name: string;
  iconEmoji: string;
  tokenCost: number;
  animationType: string;
}

export interface ApiGiftTransaction {
  id: number;
  senderId: number;
  senderName: string;
  receiverId: number;
  giftId: number;
  giftName: string;
  giftEmoji: string;
  tokenAmount: number;
  contextType: "video" | "live";
  contextId: number;
  createdAt: string;
}

export interface ApiTokenPurchase {
  purchaseId: number;
  paymentRef: string;
  status: string;
  instructions: {
    operator: string; phone: string; amount: string; reference: string; message: string;
  };
  tokens: number;
  amountXof: number;
}

export interface ApiCreatorWallet {
  tokenBalance: number;
  xofBalance: number;
  tokenToXof: number;
  minWithdrawTokens: number;
  revenueToday:  { tokens: number; xof: number };
  revenueMonth:  { tokens: number; xof: number };
}

export async function apiGetGiftCatalog(): Promise<ApiGiftItem[]> {
  const res = await fetch(`${BASE}/gifts/catalog`);
  if (!res.ok) return [];
  return res.json() as Promise<ApiGiftItem[]>;
}

export async function apiSendGift(data: {
  giftId: number; receiverId: number; contextType: "live" | "video";
  contextId: number; senderName: string;
}): Promise<ApiGiftTransaction> {
  const res = await apiFetch("/gifts/send", { method: "POST", body: JSON.stringify(data) });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(e.error ?? "Erreur lors de l'envoi");
  }
  return res.json() as Promise<ApiGiftTransaction>;
}

export async function apiGetTopDonors(contextType: "live" | "video", contextId: number) {
  const res = await fetch(`${BASE}/gifts/top-donors/${contextType}/${contextId}`);
  if (!res.ok) return [];
  return res.json() as Promise<{ senderId: number; senderName: string; totalTokens: number; giftsCount: number }[]>;
}

export async function apiGetReceivedGifts(limit = 20): Promise<ApiGiftTransaction[]> {
  const res = await apiFetch(`/gifts/received?limit=${limit}`);
  if (!res.ok) return [];
  return res.json() as Promise<ApiGiftTransaction[]>;
}

export interface ApiGiftHistoryItem extends ApiGiftTransaction {
  receiverName: string | null;
}

export async function apiGetGiftHistory(limit = 20, offset = 0): Promise<ApiGiftHistoryItem[]> {
  const res = await apiFetch(`/gifts/history?limit=${limit}&offset=${offset}`);
  if (!res.ok) return [];
  return res.json() as Promise<ApiGiftHistoryItem[]>;
}

export async function apiPurchaseTokens(data: {
  packId: "pack_100" | "pack_500" | "pack_2000";
  paymentMethod: "orange" | "mtn" | "wave";
  paymentPhone: string;
}): Promise<ApiTokenPurchase> {
  const res = await apiFetch("/tokens/purchase", { method: "POST", body: JSON.stringify(data) });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(e.error ?? "Achat échoué");
  }
  return res.json() as Promise<ApiTokenPurchase>;
}

export async function apiGetTokenPurchaseStatus(purchaseId: number): Promise<{ id: number; status: string; tokens: number; amountXof: number }> {
  const res = await apiFetch(`/tokens/purchases/${purchaseId}`);
  if (!res.ok) throw new Error("Achat introuvable");
  return res.json() as Promise<{ id: number; status: string; tokens: number; amountXof: number }>;
}

export async function apiGetCreatorWallet(): Promise<ApiCreatorWallet> {
  const res = await apiFetch("/creator/wallet");
  if (!res.ok) throw new Error("Wallet non disponible");
  return res.json() as Promise<ApiCreatorWallet>;
}

export async function apiRequestWithdrawal(data: {
  paymentMethod: "orange" | "mtn" | "wave";
  paymentPhone: string;
  tokensAmount: number;
}): Promise<{ id: number; status: string; xofAmount: number }> {
  const res = await apiFetch("/creator/withdraw", { method: "POST", body: JSON.stringify(data) });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(e.error ?? "Retrait échoué");
  }
  return res.json() as Promise<{ id: number; status: string; xofAmount: number }>;
}

export async function apiGetWithdrawals() {
  const res = await apiFetch("/creator/withdrawals");
  if (!res.ok) return [];
  return res.json() as Promise<{ id: number; tokensAmount: number; xofAmount: number; status: string; paymentMethod: string; paymentPhone: string; createdAt: string }[]>;
}

export interface AdminWithdrawal {
  id: number;
  creatorId: number;
  creatorName: string;
  tokensAmount: number;
  xofAmount: number;
  status: "pending" | "validated" | "paid" | "rejected";
  paymentMethod: string;
  paymentPhone: string;
  adminNote: string | null;
  createdAt: string;
}

export async function apiAdminGetWithdrawals(status?: string): Promise<AdminWithdrawal[]> {
  const qs = status && status !== "all" ? `?status=${status}` : "";
  const res = await apiFetch(`/admin/withdrawals${qs}`);
  if (!res.ok) return [];
  return res.json();
}

export interface AdminReportUser {
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface AdminReport {
  id: number;
  reason: string;
  status: "pending" | "reviewed" | "dismissed";
  createdAt: string;
  reporter: AdminReportUser;
  reported: AdminReportUser;
}

export interface AdminReportsResponse {
  reports: AdminReport[];
  total: number;
  page: number;
  totalPages: number;
}

export async function apiAdminGetReports(params?: {
  page?: number;
  sort?: "asc" | "desc";
  status?: string;
}): Promise<AdminReportsResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.status && params.status !== "all") qs.set("status", params.status);
  const query = qs.toString() ? `?${qs.toString()}` : "";
  const res = await apiFetch(`/admin/reports${query}`);
  if (!res.ok) return { reports: [], total: 0, page: 1, totalPages: 1 };
  return res.json();
}

export async function apiAdminPatchReport(
  id: number,
  action: "reviewed" | "dismissed",
): Promise<{ id: number; status: string }> {
  const res = await apiFetch(`/admin/reports/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(e.error ?? "Action échouée");
  }
  return res.json();
}

export async function apiAdminPatchWithdrawal(
  id: number,
  action: "validated" | "paid" | "rejected",
  adminNote?: string,
): Promise<AdminWithdrawal> {
  const res = await apiFetch(`/admin/withdrawals/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ action, adminNote }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(e.error ?? "Action échouée");
  }
  return res.json();
}

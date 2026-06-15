import { useState, useEffect } from "react";
import { Router, useLocation, useNavigate } from "./router";
import Layout from "./Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Community from "./pages/Community";
import MarketplacePage from "./pages/MarketplacePage";
import NotificationsPage from "./pages/NotificationsPage";
import Menu from "./pages/Menu";
import Profile from "./pages/Profile";
import Messages from "./pages/Messages";
import Admin from "./pages/Admin";
import JobsPage from "./pages/JobsPage";
import FormationsPage from "./pages/FormationsPage";
import TontinesPage from "./pages/TontinesPage";
import WalletPage from "./pages/WalletPage";
import ProductDetail from "./pages/ProductDetail";
import JobDetail from "./pages/JobDetail";
import FormationDetail from "./pages/FormationDetail";
import CreatePostPage from "./pages/CreatePostPage";
import CreateStoryPage from "./pages/CreateStoryPage";
import CreateReelPage from "./pages/CreateReelPage";
import CreateLifeEventPage from "./pages/CreateLifeEventPage";
import LiveStreamPage from "./pages/LiveStreamPage";
import LiveWatchPage from "./pages/LiveWatchPage";
import EditProfilePage from "./pages/EditProfilePage";
import ScorePage from "./pages/ScorePage";
import UserProfilePage from "./pages/UserProfilePage";
import CreatorDashboardPage from "./pages/CreatorDashboardPage";
import VideoPostPage from "./pages/VideoPostPage";
import PostDetailPage from "./pages/PostDetailPage";
import SearchPage from "./pages/SearchPage";
import GroupDetailPage from "./pages/GroupDetailPage";
import EventsPage from "./pages/EventsPage";
import SavedPage from "./pages/SavedPage";
import MemoriesPage from "./pages/MemoriesPage";
import JobInboxPage from "./pages/JobInboxPage";

import { ADMIN_SECRET_PATH } from "./lib/admin";
import { Post } from "./lib/store";
import { apiGetPosts, apiLikePost, apiCreatePost, getBpToken } from "./lib/api";
import InstallBanner from "./components/InstallBanner";
import TopLoadingBar from "./components/TopLoadingBar";
import { usePushNotifications } from "./hooks/usePushNotifications";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h} h`;
  return `Il y a ${Math.floor(h / 24)} j`;
}

const PUBLIC_PATHS = ["/login", "/register"];
const NO_LAYOUT_PATHS = [ADMIN_SECRET_PATH];

function matchDynamic(pattern: string, path: string): Record<string, string> | null {
  const pp = pattern.split("/");
  const lp = path.split("/");
  if (pp.length !== lp.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(":")) {
      params[pp[i].slice(1)] = lp[i];
    } else if (pp[i] !== lp[i]) {
      return null;
    }
  }
  return params;
}

function PushAutoSubscribe() {
  const isAuth = Boolean(localStorage.getItem("fb_user"));
  const { permission, subscribed, subscribe } = usePushNotifications();

  useEffect(() => {
    if (!isAuth) return;
    if (permission === "default" && !subscribed) {
      const t = setTimeout(() => subscribe(), 5000);
      return () => clearTimeout(t);
    }
  }, [isAuth, permission, subscribed, subscribe]);

  return null;
}

function AppContent() {
  const path = useLocation();
  const navigate = useNavigate();
  const isAuth = Boolean(localStorage.getItem("fb_user"));
  const isPublic = PUBLIC_PATHS.includes(path);

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  const loadPosts = async () => {
    try {
      const data = await apiGetPosts();
      const converted: Post[] = data.map((p) => ({
        id: p.id,
        userId: p.authorId,
        content: p.content,
        time: relativeTime(p.createdAt),
        likes: p.likesCount,
        comments: p.commentsCount,
        shares: 0,
        liked: p.liked,
        sponsored: false,
        imageUrl: p.imageUrl,
        thumbnailUrl: p.thumbnailUrl,
        authorName: p.authorName,
        authorAvatarUrl: p.authorAvatarUrl,
        authorCountry: p.authorCountry ?? undefined,
      }));
      setPosts(converted);
    } catch {
      // keep empty
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuth) loadPosts();
    else setPostsLoading(false);
  }, [isAuth]);

  const handleNewPost = async (content: string) => {
    const token = getBpToken();
    if (token) {
      try {
        await apiCreatePost(content);
        await loadPosts();
      } catch {
        // silent fallback — post added locally
      }
    }
    navigate("/");
  };

  const handleLike = async (id: number) => {
    const post = posts.find(p => p.id === id);
    const action = post?.liked ? "unlike" : "like";
    const token = getBpToken();
    if (token) {
      try {
        await apiLikePost(id, action);
      } catch { /* ignore */ }
    }
    setPosts(prev =>
      prev.map(p =>
        p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
      )
    );
  };

  useEffect(() => {
    const handler = () => { navigate("/login"); };
    window.addEventListener("bp:session-expired", handler);
    return () => window.removeEventListener("bp:session-expired", handler);
  }, []);

  useEffect(() => {
    if (!isAuth && !isPublic) navigate("/login");
    else if (isAuth && isPublic) navigate("/");
  }, [path, isAuth, isPublic]);

  if (!isAuth && !isPublic) return null;
  if (isAuth && isPublic) return null;

  if (path === "/login") return <Login />;
  if (path === "/register") return <Register />;
  if (path === ADMIN_SECRET_PATH) return <Admin />;
  if (path === "/create-post") return <CreatePostPage onPublish={handleNewPost} />;
  if (path === "/create-story") return <CreateStoryPage onCreated={loadPosts} />;
  if (path === "/create-reel") return <CreateReelPage />;
  if (path === "/create-life-event") return <CreateLifeEventPage />;
  if (path === "/live") return <LiveStreamPage />;
  if (path === "/edit-profile") return <EditProfilePage />;
  if (path === "/creator") return <CreatorDashboardPage />;

  const liveWatchMatch = matchDynamic("/live/:id", path);
  if (liveWatchMatch) {
    const sid = parseInt(liveWatchMatch.id, 10);
    if (!isNaN(sid)) return <LiveWatchPage streamId={sid} />;
  }

  const videoPostMatch = matchDynamic("/video/:id", path);
  if (videoPostMatch) {
    const pid = parseInt(videoPostMatch.id, 10);
    if (!isNaN(pid)) return (
      <Layout onNewPost={handleNewPost}>
        <VideoPostPage postId={pid} />
      </Layout>
    );
  }

  const postDetailMatch = matchDynamic("/post/:id", path);
  if (postDetailMatch) {
    const pid = parseInt(postDetailMatch.id, 10);
    if (!isNaN(pid)) return <PostDetailPage postId={pid} />;
  }

  if (path === "/score") return <ScorePage />;
  if (path === "/events") return (
    <Layout onNewPost={handleNewPost}><EventsPage /></Layout>
  );
  if (path === "/saved") return (
    <Layout onNewPost={handleNewPost}><SavedPage /></Layout>
  );
  if (path === "/memories") return (
    <Layout onNewPost={handleNewPost}><MemoriesPage /></Layout>
  );

  // Search route — path may include query string: /search?q=...
  if (path.startsWith("/search")) {
    const qs = path.includes("?") ? path.slice(path.indexOf("?") + 1) : "";
    const q = new URLSearchParams(qs).get("q") ?? "";
    return (
      <Layout onNewPost={handleNewPost}>
        <SearchPage q={q} />
      </Layout>
    );
  }

  // Dynamic route matching
  const productMatch = matchDynamic("/marketplace/:id", path);
  const jobMatch = matchDynamic("/jobs/:id", path);
  const formationMatch = matchDynamic("/formations/:id", path);
  const userProfileMatch = matchDynamic("/profile/:id", path);
  const groupMatch = matchDynamic("/groups/:id", path);
  const chatGroupMatch = matchDynamic("/chat-groups/:id", path);
  const tontineDetailMatch = matchDynamic("/tontines/:id", path);

  if (productMatch) {
    return (
      <Layout onNewPost={handleNewPost}>
        <ProductDetail id={parseInt(productMatch.id)} />
      </Layout>
    );
  }

  if (path === "/jobs/inbox") {
    return (
      <Layout onNewPost={handleNewPost}>
        <JobInboxPage />
      </Layout>
    );
  }

  if (path.startsWith("/jobs/inbox?")) {
    const qs3 = path.slice(path.indexOf("?") + 1);
    const p3  = new URLSearchParams(qs3);
    const uid = parseInt(p3.get("userId") ?? "0", 10);
    const jt  = p3.get("jobTitle") ?? undefined;
    return (
      <Layout onNewPost={handleNewPost}>
        <JobInboxPage initialUserId={isNaN(uid) ? undefined : uid} initialJobTitle={jt} />
      </Layout>
    );
  }

  if (jobMatch) {
    return (
      <Layout onNewPost={handleNewPost}>
        <JobDetail id={parseInt(jobMatch.id)} />
      </Layout>
    );
  }

  if (formationMatch) {
    return (
      <Layout onNewPost={handleNewPost}>
        <FormationDetail id={parseInt(formationMatch.id)} />
      </Layout>
    );
  }

  if (userProfileMatch) {
    return (
      <Layout onNewPost={handleNewPost}>
        <UserProfilePage userId={parseInt(userProfileMatch.id)} />
      </Layout>
    );
  }

  const userAliasMatch = matchDynamic("/user/:id", path);
  if (userAliasMatch) {
    const uid = parseInt(userAliasMatch.id, 10);
    if (!isNaN(uid)) return (
      <Layout onNewPost={handleNewPost}>
        <UserProfilePage userId={uid} />
      </Layout>
    );
  }

  if (groupMatch) {
    const gid = parseInt(groupMatch.id, 10);
    if (!isNaN(gid)) {
      return (
        <Layout onNewPost={handleNewPost}>
          <GroupDetailPage groupId={gid} />
        </Layout>
      );
    }
  }

  if (chatGroupMatch) {
    const cgid = parseInt(chatGroupMatch.id, 10);
    if (!isNaN(cgid)) {
      return (
        <Layout onNewPost={handleNewPost}>
          <Messages initialGroupId={cgid} />
        </Layout>
      );
    }
  }

  if (tontineDetailMatch) {
    const tid = parseInt(tontineDetailMatch.id, 10);
    if (!isNaN(tid)) {
      return (
        <Layout onNewPost={handleNewPost}>
          <TontinesPage initialTontineId={tid} />
        </Layout>
      );
    }
  }

  return (
    <Layout onNewPost={handleNewPost}>
      {path === "/" && <Home posts={posts} postsLoading={postsLoading} onLike={handleLike} onNewPost={handleNewPost} />}
      {path === "/community" && <Community />}
      {path === "/marketplace" && <MarketplacePage />}
      {path === "/notifications" && <NotificationsPage />}
      {path === "/menu" && <Menu />}
      {path === "/profile" && <Profile />}
      {path.startsWith("/messages") && (() => {
        const qs2 = path.includes("?") ? path.slice(path.indexOf("?") + 1) : "";
        const uid = new URLSearchParams(qs2).get("userId");
        const initUid = uid ? parseInt(uid, 10) : undefined;
        return <Messages initialUserId={!initUid || isNaN(initUid) ? undefined : initUid} />;
      })()}
      {path === "/jobs" && <JobsPage />}
      {path === "/formations" && <FormationsPage />}
      {path === "/tontines" && <TontinesPage />}
      {path === "/wallet" && <WalletPage />}
    </Layout>
  );
}

export default function App() {
  return (
    <Router>
      <TopLoadingBar />
      <PushAutoSubscribe />
      <AppContent />
      <InstallBanner />
    </Router>
  );
}

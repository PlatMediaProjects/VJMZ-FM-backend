import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlayerProvider } from "@/lib/playerContext";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute, DJProtectedRoute, AdminProtectedRoute } from "@/lib/protected-route";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Shows from "@/pages/Shows";
import AuthPage from "@/pages/auth-page";
import DjStudio from "@/pages/dj-studio";
import ProfilePage from "@/pages/ProfilePage";
import NotFound from "@/pages/not-found";
import SongRequests from "@/pages/SongRequests";
import AiChat from "@/pages/AiChat";
import NotificationPreferences from "@/pages/NotificationPreferences";
import MusicSubmission from "@/pages/MusicSubmission";
import AdminDashboard from "@/pages/AdminDashboard";
import TeamBio from "@/pages/TeamBio";
import Gallery from "@/pages/Gallery";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PlayerProvider>
          <TooltipProvider>
            <Switch>
              <Route path="/auth" component={AuthPage} />
              
              <Route path="/">
                <Layout>
                  <Home />
                </Layout>
              </Route>
              
              <Route path="/shows">
                <Layout>
                  <Shows />
                </Layout>
              </Route>
              
              <DJProtectedRoute 
                path="/dj-studio" 
                component={() => (
                  <Layout>
                    <DjStudio />
                  </Layout>
                )}
              />
              
              <AdminProtectedRoute 
                path="/admin" 
                component={() => (
                  <Layout>
                    <AdminDashboard />
                  </Layout>
                )}
              />
              
              <ProtectedRoute 
                path="/profile"
                component={() => (
                  <Layout>
                    <ProfilePage />
                  </Layout>
                )}
              />

              <ProtectedRoute 
                path="/profile/:userId"
                component={() => (
                  <Layout>
                    <ProfilePage />
                  </Layout>
                )}
              />
              
              <ProtectedRoute 
                path="/song-requests"
                component={() => (
                  <Layout>
                    <SongRequests />
                  </Layout>
                )}
              />
              
              <ProtectedRoute 
                path="/ai-chat"
                component={() => (
                  <Layout>
                    <AiChat />
                  </Layout>
                )}
              />
              
              <ProtectedRoute 
                path="/notifications"
                component={() => (
                  <Layout>
                    <NotificationPreferences />
                  </Layout>
                )}
              />
              
              <Route path="/music-submission">
                <Layout>
                  <MusicSubmission />
                </Layout>
              </Route>
              
              <Route path="/team-bio">
                <Layout>
                  <TeamBio />
                </Layout>
              </Route>
              
              <Route path="/gallery">
                <Layout>
                  <Gallery />
                </Layout>
              </Route>
              
              <Route>
                <Layout>
                  <NotFound />
                </Layout>
              </Route>
            </Switch>
            <Toaster />
          </TooltipProvider>
        </PlayerProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

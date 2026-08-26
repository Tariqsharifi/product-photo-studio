import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, Image as ImageIcon, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";
import PhotoEditor from "@/components/PhotoEditor";
import BackgroundRemover from "@/components/BackgroundRemover";
import InstallGuide from "@/components/InstallGuide";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <main className="min-h-screen bg-background px-4 md:px-6 py-6 text-foreground pb-20">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Welcome to PhotoCut
            </p>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight">
              Photo Editor{user?.name ? ` — ${user.name}` : ""}
            </h1>
          </div>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer gap-2 self-start"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </header>

        <Tabs defaultValue="editor" className="w-full">
          <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:flex sm:w-auto">
            <TabsTrigger value="editor" className="gap-2">
              <ImageIcon className="w-4 h-4" />
              Photo Editor
            </TabsTrigger>
            <TabsTrigger value="bg-remove" className="gap-2">
              <Sparkles className="w-4 h-4" />
              AI Background Remover
            </TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="mt-4">
            <div className="h-[calc(100vh-220px)] min-h-[500px]">
              <PhotoEditor />
            </div>
          </TabsContent>

          <TabsContent value="bg-remove" className="mt-4">
            <BackgroundRemover />
          </TabsContent>
        </Tabs>
      </div>
      
      <InstallGuide />
    </main>
  );
}

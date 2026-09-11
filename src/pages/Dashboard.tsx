import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image as ImageIcon, Sparkles } from "lucide-react";
import PhotoEditor from "@/components/PhotoEditor";
import BackgroundRemover from "@/components/BackgroundRemover";
import InstallGuide from "@/components/InstallGuide";

export default function Dashboard() {
  return (
    <main className="min-h-screen bg-background px-4 md:px-6 py-6 text-foreground pb-20">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header>
          <p className="text-sm font-medium text-muted-foreground">
            Welcome to PhotoCut
          </p>
          <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight">
            Photo Editor
          </h1>
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

import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

export default function SplashScreen() {
  return (
    <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center relative overflow-hidden">
      {/* Video Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-black/50 z-10" /> {/* Overlay for better text contrast */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        >
          <source src="/assets/splash-animation.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Content */}
      <div className="relative z-20 flex flex-col items-center space-y-8 animate-in fade-in duration-1000">
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight">
            ARIAN-N
          </h1>
          <p className="text-xl text-gray-200 max-w-md mx-auto font-light">
            AI Negotiation Platform
          </p>
        </div>

        <Link href="/login">
          <Button
            size="lg"
            className="bg-white text-black hover:bg-gray-200 font-semibold px-8 py-6 text-lg rounded-full transition-all transform hover:scale-105"
          >
            <LogIn className="mr-2 h-5 w-5" />
            Sign In to Platform
          </Button>
        </Link>
      </div>

      {/* Footer Logos */}
      <div className="absolute bottom-8 z-20 flex gap-8 items-center opacity-80">
        <img 
          src="/assets/retail-ai-logo-weiss-2025.svg" 
          alt="Retail AI" 
          className="h-8 w-auto"
        />
        <img 
          src="/assets/HSM_Logo_Dachmarke_RGB_neg.png" 
          alt="HSM" 
          className="h-8 w-auto"
        />
      </div>
    </div>
  );
}

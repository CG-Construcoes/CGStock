'use client';

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function PrintButton() {
  useEffect(() => {
    let prevTitle = ""
    const handleBeforePrint = () => {
      prevTitle = document.title
      document.title = ""
    }
    const handleAfterPrint = () => {
      if (prevTitle) {
        document.title = prevTitle
      }
    }
    window.addEventListener("beforeprint", handleBeforePrint)
    window.addEventListener("afterprint", handleAfterPrint)
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint)
      window.removeEventListener("afterprint", handleAfterPrint)
    }
  }, [])

  const handlePrint = () => {
    const prevTitle = document.title
    document.title = ""
    window.print()
    setTimeout(() => {
      document.title = prevTitle
    }, 1000)
  }

  return (
    <Button onClick={handlePrint} className="gap-2 bg-primary hover:bg-primary">
      <Printer className="h-4 w-4" />
      Imprimir Crachás
    </Button>
  );
}

"use client"
import { Languages } from "lucide-react"
import { useLanguage } from "@/components/language-provider"
export function LanguageSwitcher(){const {language,setLanguage}=useLanguage();return <button onClick={()=>setLanguage(language==="en"?"ru":"en")} className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[10px] font-bold"><Languages className="h-3.5 w-3.5" />{language==="en"?"EN":"RU"}</button>}

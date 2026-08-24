"use client"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
export type Language = "en" | "ru"
const strings = { en: { cases:"Cases", battles:"Battles", crash:"Crash", upgrade:"Upgrade", profile:"Profile", guest:"Guest", demo:"demo" }, ru: { cases:"Кейсы", battles:"Битвы", crash:"Краш", upgrade:"Апгрейд", profile:"Профиль", guest:"Гость", demo:"демо" } } as const
type Key = keyof typeof strings.en
const Ctx = createContext<{language:Language; setLanguage:(x:Language)=>void; t:(key:Key)=>string}|null>(null)
export function LanguageProvider({children}:{children:ReactNode}) { const [language,setLanguageState]=useState<Language>("en"); useEffect(()=>{const x=localStorage.getItem("puggift-language");if(x==="en"||x==="ru")setLanguageState(x)},[]); const setLanguage=(x:Language)=>{setLanguageState(x);localStorage.setItem("puggift-language",x);document.documentElement.lang=x}; return <Ctx.Provider value={{language,setLanguage,t:(key)=>strings[language][key]}}>{children}</Ctx.Provider> }
export function useLanguage(){const v=useContext(Ctx);if(!v)throw new Error("LanguageProvider missing");return v}

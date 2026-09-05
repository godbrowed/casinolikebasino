export default function Loading() {
  return <div role="status" aria-label="Loading PugGift" className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#202225]">
    <div className="relative flex h-16 w-16 items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/puggift-mark-v4.svg" alt="" className="h-full w-full rounded-2xl object-cover" />
    </div>
    <div className="mt-4 font-display text-xl font-bold">PugGift</div>
    <div className="mt-3 flex gap-1.5">{[0, 1, 2].map((index) => <i key={index} className="pug-loader-dot h-2 w-2 rounded-full bg-[#4d7bff]" style={{ animationDelay: `${index * .14}s` }} />)}</div>
  </div>
}

import { Button } from "@/components/ui/button";

export function ArrivalLanguageSwitch({ spanish = false }: { spanish?: boolean }) {
  return <Button className="mt-4" onClick={() => {
    const url = new URL(window.location.href);
    url.pathname = url.pathname.replace(spanish ? /^\/llegar\// : /^\/arrive\//, spanish ? "/arrive/" : "/llegar/");
    window.location.assign(url.pathname + url.search + url.hash);
  }}>{spanish ? "English" : "Español"}</Button>;
}
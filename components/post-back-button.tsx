"use client";

import { useRouter } from "next/navigation";

type PostBackButtonProps = {
  fallbackHref?: string;
  label?: string;
};

export function PostBackButton({
  fallbackHref = "/",
  label = "Back"
}: PostBackButtonProps) {
  const router = useRouter();

  return (
    <button
      className="mini-link dark back-button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
          return;
        }

        router.push(fallbackHref);
      }}
      type="button"
    >
      {label}
    </button>
  );
}

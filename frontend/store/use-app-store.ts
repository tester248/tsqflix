"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface WatchItem {
  id: string;
  title: string;
  poster: string;
  type: "movie" | "tv";
  timestamp: number;
  duration: number;
  lastUpdated: number;
}

export interface BookmarkItem {
  id: string;
  title: string;
  poster: string;
  type: "movie" | "tv";
  addedAt: number;
}

interface AppState {
  history: WatchItem[];
  bookmarks: BookmarkItem[];
  
  // Actions
  addHistory: (item: Omit<WatchItem, "lastUpdated">) => void;
  removeHistory: (id: string) => void;
  addBookmark: (item: Omit<BookmarkItem, "addedAt">) => void;
  removeBookmark: (id: string) => void;
  isBookmarked: (id: string) => boolean;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      history: [],
      bookmarks: [],

      addHistory: (item) => {
        set((state) => {
          const filtered = state.history.filter((h) => h.id !== item.id);
          return {
            history: [
              { ...item, lastUpdated: Date.now() },
              ...filtered,
            ].slice(0, 50), // Keep last 50
          };
        });
      },

      removeHistory: (id) => {
        set((state) => ({
          history: state.history.filter((h) => h.id !== id),
        }));
      },

      addBookmark: (item) => {
        set((state) => ({
          bookmarks: [
            { ...item, addedAt: Date.now() },
            ...state.bookmarks.filter((b) => b.id !== item.id),
          ],
        }));
      },

      removeBookmark: (id) => {
        set((state) => ({
          bookmarks: state.bookmarks.filter((b) => b.id !== id),
        }));
      },

      isBookmarked: (id) => {
        return get().bookmarks.some((b) => b.id === id);
      },
    }),
    {
      name: "tsqflix-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export interface Review {
  id: string;
  reviewerName: string;
  reviewerAvatar: string;
  rating: number;
  comment: string;
  date: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  ageGroup: '6-8' | '8-10' | '10-12';
  summary: string;
  coverColor: string;
  coverPattern: 'stripes' | 'stars' | 'circles' | 'waves' | 'grid';
  emoji: string;
  totalCopies: number;
  availableCopies: number;
  publishedYear: number;
  pages: number;
  rating: number;
  reviews: Review[];
}

export interface Event {
  id: string;
  title: string;
  date: string; // ISO format e.g. "2026-06-25"
  time: string;
  location: string;
  icon: 'reading' | 'craft' | 'party' | 'quiz' | 'book';
  description: string;
  color: string;
}

export interface NewsItem {
  id: string;
  title: string;
  date: string;
  content: string;
  category: 'neu' | 'aktion' | 'wichtig' | 'tipp';
  color: string; // Tailwind class like bg-yellow-100
  rotation: string; // Tailwind rotate class e.g., rotate-1, -rotate-2
}

export interface BorrowedBook {
  bookId: string;
  borrowDate: string;
  dueDate: string;
}

export interface LibraryCard {
  name: string;
  cardNumber: string;
  avatar: string; // ID of chosen avatar
  level: number;
  xp: number;
  badges: string[]; // Badge IDs
  borrowedBooks: BorrowedBook[];
  bookmarks: string[]; // Book IDs
  reservations: string[]; // Book IDs
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // Index in options
  explanation: string;
  bookReference?: string;
}

export interface BookSuggestion {
  id: string;
  title: string;
  author: string;
  reason: string;
  suggestorName: string;
  votes: number;
  date: string;
}

export interface AvatarOption {
  id: string;
  emoji: string;
  name: string;
  color: string;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  emoji: string;
  color: string;
}

export interface Teacher {
  id: string;
  username: string;
  name: string;
  password?: string;
  createdAt?: string;
}


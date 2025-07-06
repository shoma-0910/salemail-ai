"use client";

import { useEffect, useState } from "react";
import { auth, provider, db } from "../lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";

export default function Home() {
  const [form, setForm] = useState({
    company: "",
    product: "",
    target: "",
    benefit: "",
    tone: "丁寧",
    purpose: "初回提案",
  });
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ id: string; form: typeof form; result: string }>>([]);
  const [user, setUser] = useState<User | null>(null);

  const [keyword, setKeyword] = useState("");
  const [filterTone, setFilterTone] = useState("すべて");
  const [filterPurpose, setFilterPurpose] = useState("すべて");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user) fetchHistory(user.uid);
  }, [user]);

  const fetchHistory = async (uid: string) => {
    try {
      const q = query(
        collection(db, "email_histories"),
        where("userId", "==", uid),
        orderBy("createdAt", sortOrder)
      );
      const snapshot = await getDocs(q);
      let docs = snapshot.docs.map((doc) => {
        const data = doc.data();
        return { id: doc.id, form: data.form, result: data.result };
      });

      if (keyword.trim()) {
        docs = docs.filter(
          (item) =>
            item.form.company.includes(keyword) ||
            item.form.product.includes(keyword)
        );
      }

      if (filterTone !== "すべて") {
        docs = docs.filter((item) => item.form.tone === filterTone);
      }

      if (filterPurpose !== "すべて") {
        docs = docs.filter((item) => item.form.purpose === filterPurpose);
      }

      setHistory(docs);
    } catch (error) {
      console.error("履歴取得エラー", error);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error("Login error", e);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setHistory([]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setResult("");
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`APIエラー: ${res.status} - ${errorText}`);
      }

      const data = await res.json();
      setResult(data.result);

      if (user) {
        await addDoc(collection(db, "email_histories"), {
          userId: user.uid,
          form: { ...form },
          result: data.result,
          createdAt: serverTimestamp(),
        });
        fetchHistory(user.uid);
      }
    } catch (e) {
      console.error("⚠️ 生成エラー:", e);
      setResult("⚠️ エラーが発生しました。詳細: " + e);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = (item: { form: typeof form; result: string }) => {
    setForm(item.form);
    setResult(item.result);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この履歴を削除しますか？")) return;
    try {
      await deleteDoc(doc(db, "email_histories", id));
      if (user) fetchHistory(user.uid);
    } catch (error) {
      console.error("削除エラー", error);
    }
  };

  const handleExportCSV = () => {
    if (history.length === 0) return;
  
    const header = ["会社名", "サービス名", "ターゲット", "アピールポイント", "トーン", "目的", "メール本文"];
    const rows = history.map((item) => [
      item.form.company,
      item.form.product,
      item.form.target,
      item.form.benefit,
      item.form.tone,
      item.form.purpose,
      item.result.replace(/\n/g, " ")  // 改行をスペースに
    ]);
  
    const csvContent =
      [header, ...rows]
        .map((row) => row.map((v) => `"${v}"`).join(","))
        .join("\n");
  
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
  
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "email_history.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  

  return (
    <main className="min-h-screen bg-white text-gray-800 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white shadow-md rounded-lg p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">📬 営業メール自動生成</h1>
          {user ? (
            <button onClick={handleLogout} className="text-sm text-red-600 underline">
              ログアウト
            </button>
          ) : (
            <button onClick={handleLogin} className="text-sm text-blue-600 underline">
              Googleでログイン
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          <input name="company" placeholder="貴社名" value={form.company} onChange={handleChange} className="border rounded-md px-3 py-2 w-full" />
          <input name="product" placeholder="サービス名" value={form.product} onChange={handleChange} className="border rounded-md px-3 py-2 w-full" />
          <input name="target" placeholder="ターゲット" value={form.target} onChange={handleChange} className="border rounded-md px-3 py-2 w-full" />
          <input name="benefit" placeholder="アピールポイント" value={form.benefit} onChange={handleChange} className="border rounded-md px-3 py-2 w-full" />
          <select name="tone" value={form.tone} onChange={handleChange} className="border rounded-md px-3 py-2 w-full">
            <option value="丁寧">丁寧</option>
            <option value="カジュアル">カジュアル</option>
          </select>
          <select name="purpose" value={form.purpose} onChange={handleChange} className="border rounded-md px-3 py-2 w-full">
            <option value="初回提案">初回提案</option>
            <option value="再提案">再提案</option>
            <option value="デモ案内">デモ案内</option>
          </select>
        </div>

        <button onClick={handleGenerate} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded">
          {loading ? "生成中..." : "生成する"}
        </button>

        {result && (
          <div className="mt-4 border border-gray-200 p-4 rounded-md bg-gray-50 text-sm whitespace-pre-wrap">
            {result}
          </div>
        )}

        {user && (
          <div className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold">📂 履歴フィルター</h2>
            <input
              type="text"
              placeholder="キーワード検索（会社名やサービス名）"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="border px-3 py-2 w-full rounded"
            />
            <div className="flex gap-2">
              <select value={filterTone} onChange={(e) => setFilterTone(e.target.value)} className="border rounded px-2 py-1 w-1/2">
                <option value="すべて">すべてのトーン</option>
                <option value="丁寧">丁寧</option>
                <option value="カジュアル">カジュアル</option>
              </select>
              <select value={filterPurpose} onChange={(e) => setFilterPurpose(e.target.value)} className="border rounded px-2 py-1 w-1/2">
                <option value="すべて">すべての目的</option>
                <option value="初回提案">初回提案</option>
                <option value="再提案">再提案</option>
                <option value="デモ案内">デモ案内</option>
              </select>
            </div>
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value as "asc" | "desc");
                if (user) fetchHistory(user.uid);
              }}
              className="border rounded px-2 py-1 w-full"
            >
              <option value="desc">新しい順</option>
              <option value="asc">古い順</option>
            </select>

            <button
              onClick={() => user && fetchHistory(user.uid)}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 rounded"
            >
              🔍 検索する
            </button>

            <button
  onClick={handleExportCSV}
  className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded"
>
  📥 CSVエクスポート
</button>


            {history.length === 0 ? (
              <p className="text-gray-500 text-sm">🔍 条件に一致する履歴は見つかりませんでした。</p>
            ) : (
              <ul className="space-y-2">
                {history.map((item) => (
                  <li key={item.id} className="border p-3 rounded bg-gray-100 hover:bg-gray-200 flex justify-between items-start">
                    <div className="cursor-pointer w-full" onClick={() => handleRestore(item)}>
                      <div className="text-sm font-medium">
                        {item.form.company} - {item.form.product} ({item.form.purpose})
                      </div>
                      <div className="text-xs text-gray-600 line-clamp-2">
                        {item.result.slice(0, 80)}...
                      </div>
                    </div>
                    <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700 text-sm ml-2">
                      🗑️
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      {result && (
  <div className="mt-4 border border-gray-200 p-4 rounded-md bg-gray-50 text-sm whitespace-pre-wrap">
    {result}

    {/* 📋 コピー & 📤 Gmailで開く */}
    <div className="mt-3 flex gap-3">
      <button
        onClick={() => {
          navigator.clipboard.writeText(result);
          alert("コピーしました！");
        }}
        className="text-sm bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded"
      >
        📋 コピー
      </button>

      <a
        href={`mailto:?subject=営業のご提案&body=${encodeURIComponent(result)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded inline-block"
      >
        📤 Gmailで開く
      </a>
    </div>
  </div>
)}

    </main>
  );
}

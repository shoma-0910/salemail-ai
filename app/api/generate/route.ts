// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { company, product, target, benefit, tone, purpose, sortBy, keyword } = body;

    // 入力バリデーションを追加
    if (![company, product, target, benefit, tone, purpose].every(
      (v) => typeof v === "string" && v.trim() !== ""
    )) {
      return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
    }

    const prompt = `
以下の条件に基づいて、自然な営業メールを日本語で生成してください。

- 貴社名: ${company}
- サービス名: ${product}
- ターゲット: ${target}
- アピールポイント: ${benefit}
- トーン: ${tone}
- メールの目的: ${purpose}

件名と本文を含めてください。`;

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const result = chatCompletion.choices[0].message.content;
    return NextResponse.json({ result });
  } catch (e: any) {
    console.error("❌ APIエラー:", e.message);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}

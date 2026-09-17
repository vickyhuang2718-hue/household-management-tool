import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  slot: z.string(),
  dishes: z
    .array(
      z.object({
        name: z.string(),
        babyTag: z.string(),
        notes: z.string().optional().nullable(),
      }),
    )
    .min(1),
});

export const getCookingGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("暂时无法生成步骤，请稍后再试。");

    const dishList = data.dishes
      .map(
        (dish, index) =>
          `${index + 1}. ${dish.name}（宝宝：${dish.babyTag}）${
            dish.notes ? `备注：${dish.notes}` : ""
          }`,
      )
      .join("\n");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "你是一位家庭厨房帮手。用简体中文写出把这一餐所有菜一起做好的分步流程，按时间顺序合并（先泡先腌、再切、再炒），标出每步大概几分钟。家里有一个2岁宝宝：标着「宝宝可食」的菜要少盐少油；标着「调味前宝宝可食」的菜要在放盐/酱油前先盛出宝宝那份，并在步骤里明确提醒；标着「宝宝不宜」的菜提醒不要给宝宝。输出用 Markdown：先「准备 Prep」列表，再「步骤」有序列表，最后一行「上桌提示」。不要寒暄，不要加代码块。",
            },
            {
              role: "user",
              content: `这一餐是${data.slot}，需要做这些菜：\n${dishList}`,
            },
          ],
        }),
      },
    );

    if (response.status === 429) throw new Error("请求太频繁了，等一会儿再试。");
    if (response.status === 402) throw new Error("AI 额度用完了，请先充值。");
    if (!response.ok) throw new Error("生成步骤失败，请稍后再试。");

    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return { guide: json.choices?.[0]?.message?.content ?? "暂时没有生成内容。" };
  });

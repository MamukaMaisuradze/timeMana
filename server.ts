import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK lazily only when requested
let openaiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!openaiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
      throw new Error("GEMINI_API_KEY_MISSING");
    }
    openaiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return openaiClient;
}

// REST Api route to optimize the schedule via Gemini
app.post("/api/optimize-schedule", async (req, res) => {
  try {
    const { tasks, energyLevel, wakeupTime, sleepTime, extraContext } = req.body;

    let ai;
    try {
      ai = getGeminiClient();
    } catch (err: any) {
      if (err.message === "GEMINI_API_KEY_MISSING") {
        return res.status(400).json({
          error: "API Key is missing",
          messageGeorgian: "Gemini API გასაღები არ არის ნაპოვნი. გთხოვთ, დაამატოთ ის Settings > Secrets პანელში.",
        });
      }
      throw err;
    }

    const tasksDescription = tasks && tasks.length > 0 
      ? tasks.map((t: any) => `- ${t.title} (${t.category}, პრიორიტეტი: ${t.priority}, დაგეგმილი პომოდოროები: ${t.estimatedPomodoros}, დასრულებული: ${t.completedPomodoros})`).join("\n")
      : "აქტიური დავალებები ჯერ არ არის დამატებული";

    const prompt = `მიიღე მომხმარებლის მიერ შემოყვანილი ინფორმაცია და შეადგინე მისთვის იდეალური დღის გეგმა.

მონაცემები:
- მომხმარებლის დავალებები დღეს:
${tasksDescription}
- მომხმარებლის მიმდინარე ენერგიის დონე: ${energyLevel || "საშუალო"}
- გაღვიძების დრო: ${wakeupTime || "08:00"}
- დაძინების დრო: ${sleepTime || "23:00"}
- დამატებითი კონტექსტი: ${extraContext || "არ არის მითითებული"}

ინსტრუქციები:
1. შექმენი დროზე გაწერილი დღის განრიგი გაღვიძებიდან დაძინებამდე.
2. გაანაწილე დავალებები ისე, რომ მაღალი პრიორიტეტის დავალებები მოთავსდეს მომხმარებლის პიკური ენერგიის პერიოდებში (მაგ. დილა, შუადღე).
3. გაითვალისწინე პომოდოროს მეთოდი (25/5 ან 50/10 ციკლები) და დაამატე მოკლე შესვენებები.
4. ყველა პასუხი (the summary, schedule description, and tips) უნდა იყოს ქართულ ენაზე, მეგობრულ, პროფესიონალურ და მოტივაციურ ტონში.
5. schedule მასივში თითოეული item-ისთვის მიუთითე: 'time' (დროის მონაკვეთი), 'activity' (აქტივობა ქართულად), 'reason' (რატომ ამ დროს ქართულად), და 'isFocusSession' (ბულიანი, არის თუ არა მაღალი ფოკუსის დავალება).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "შენ ხარ პროდუქტიულობისა და დროის მართვის წამყვანი ქართველი ექსპერტი (Time Management Expert). ეხმარები ადამიანებს დროის ეფექტურად განაწილებაში სამეცნიერო მიდგომებით (პომოდორო, ბიოლოგიური რიტმები). შენი პასუხი ყოველთვის მკაცრად ქართულ ენაზეა და სრულად შეესაბამება მოთხოვნილ JSON სტრუქტურას.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "ქართული მოკლე, მოტივაციური და სტრატეგიული შეჯამება დღევანდელი დღის გეგმისთვის.",
            },
            schedule: {
              type: Type.ARRAY,
              description: "საათობრივი ოპტიმიზებული გეგმა.",
              items: {
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING, description: "დროის ინტერვალი, მაგ. '09:00 - 10:30' ან '13:00 - 13:30'" },
                  activity: { type: Type.STRING, description: "აქტივობის ან დავალების დასახელება ქართულად" },
                  reason: { type: Type.STRING, description: "მიზეზი, თუ რატომ შეირჩა ეს დრო ქართულად" },
                  isFocusSession: { type: Type.BOOLEAN, description: "არის თუ არა ინტენსიური მუშაობის/ფოკუსის სესია" },
                },
                required: ["time", "activity", "reason", "isFocusSession"],
              },
            },
            tips: {
              type: Type.ARRAY,
              description: "3 პერსონალური, პრაქტიკული რჩევა ქართულად დროის უკეთ დასაზოგად.",
              items: { type: Type.STRING },
            },
          },
          required: ["summary", "schedule", "tips"],
        },
      },
    });

    const resultText = response.text || "{}";
    const parsedResult = JSON.parse(resultText);

    return res.json(parsedResult);
  } catch (error: any) {
    console.error("Gemini optimization error:", error);
    return res.status(500).json({
      error: "Optimization failed",
      message: error.message,
      messageGeorgian: "ოპტიმიზაციისას მოხდა შეცდომა. გთხოვთ სცადოთ მოგვიანებით.",
    });
  }
});

// Configure Vite middleware flow
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Express running on http://localhost:${PORT}`);
  });
}

startServer();

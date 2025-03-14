import "jsr:@std/dotenv/load";
// Deno.env.get()
import express from "npm:express";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import cors from "npm:cors";
// import { GenerativeModel } from "@google/generative-ai";

// FireBase
import { initializeApp } from "npm:firebase/app";
import {
	getFirestore,
	doc,
	setDoc,
	getDoc,
	updateDoc,
} from "npm:firebase/firestore";
const FireKey = Deno.env.get("FireBaseKey");
if (!FireKey) {throw new Error("Firebase API Key not found in environment variables");}
const firebaseConfig = {
	apiKey: FireKey,
	authDomain: "coeus-e1b62.firebaseapp.com",
	projectId: "coeus-e1b62",
	storageBucket: "coeus-e1b62.firebasestorage.app",
	messagingSenderId: "1095730736657",
	appId: "1:1095730736657:web:d7c424acea5b692e9d4bb0",
};
const FireApp = initializeApp(firebaseConfig);
const db = getFirestore(FireApp);


const app = express();
app.use(cors());
app.use(express.static("public"));
app.use(express.json());

// gemini
const GeminiKey = Deno.env.get("GeminiKey");
if (!GeminiKey) {throw new Error("Gemini API Key not found in environment variables");}
const genAI = new GoogleGenerativeAI(GeminiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });

async function get(url, token = null, params = {}) {
    try {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

		if (params) {
			url += "?";
			for (const key in params) {
				url += `${key}=${params[key]}&`;
			}
		}
        const response = await fetch(url, {
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(error.message);
        throw error;
    }
}

const globalContext = "You are a helpful AI assistant called Coeus";
app.post("/askgemini", async function (req, res) {
	const body = req.body;
	if (!body.prompt) {
		res.status(400).send("Prompt is required.");
		return;
	}

	const history = body.history || [];
	const prompt = body.prompt;

	// Start chat with initial context as first user message
	const chat = model.startChat({
		history: [
			{
				role: "user",
				parts: [{ text: globalContext }],
			},
			{
				role: "model",
				parts: [
					{
						text: "How can I help you?",
					},
				],
			},
			...history.map((msg) => ({
				role: msg.role === "you" ? "user" : "model",
				parts: [{ text: msg.content }],
			})),
		],
	});

	try {
		const result = await chat.sendMessage([{ text: prompt }]);
		const text = await result.response.text();

		res.json({
			answer: text,
		});
	} catch (error) {
		console.error("Gemini API error:", error);
		res.status(500).send("Error processing request");
	}
});
app.post("/buildcanvas", async function (req, res) {
    const body = req.body;
    if (!body.key || !body.url) {
        res.status(400).send("Key/URL is required.");
        return;
    }

    const userProfile = await get(`https://acalanes.instructure.com/api/v1/users/self/profile`, body.key);
    const userName = userProfile.name;
	const userId = userProfile.id;
	// console.log("User name:", userName);

    const RawBody = await get(`https://acalanes.instructure.com/api/v1/courses`, body.key, { per_page: 10 });
    const courses = [];

    for (const course of RawBody) {
        if (!course.name || course.workflow_state !== "available") {
            continue;
        }

        courses.push({
            id: course.id,
            name: course.name,
            account_id: course.account_id,
        });
    }
	// console.log("Courses:", courses);

	const grades = [];
	// let grades;

	const RawEnrollments = await get(`https://acalanes.instructure.com/api/v1/users/self/enrollments`, body.key, {per_page: 100});
	for (const enrollment of RawEnrollments) {
		if (!enrollment.grades.current_score) {
			continue;
		}
		grades.push({
			course_id: enrollment.course_id,
			grade: enrollment.grades.current_score,
		});
	}


	res.json({
		name: userName,
		canvasId: userId,
		courses: courses,
		grades: grades,
		id: userName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase(),
	});
});
app.post("/makeuser", async function (req, res) {
	const body = req.body;
	if (!body.name || !body.key || !body.url || !body.id) {
		console.log("Request missing required fields: id, name, key, or url");
		res.status(400).send("ID, name, key, and URL are required.");
		return;
	}

	try {
		const docRef = doc(db, "users", body.id);
		await setDoc(docRef, {
			name: body.name,
			key: body.key,
			url: body.url,
		});
		console.log("Document written with custom ID: ", body.id);
		res.send("Success");
	} catch (err) {
		console.error("Unexpected error:", err);
		res.status(500).send("Unexpected error occurred");
	}
});
app.post("/getuser", async function (req, res) {
    const body = req.body;
    if (!body.id) {
        console.log("Request missing required field: id");
        res.status(400).send("ID is required.");
        return;
    }

    try {
        const docRef = doc(db, "users", body.id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            console.log("User not found:", body.id);
            res.status(404).send("User not found.");
            return;
        }
        res.json(docSnap.data());
    } catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).send("Unexpected error occurred");
    }
});

app.post("/updateuser", async function (req, res) {
    const body = req.body;
    if (!body.id || !body.field || !body.value) {
        console.log("Request missing required fields: id, field, or value");
        res.status(400).send("ID, field, and value are required.");
        return;
    }

    const updateData = {};
    updateData[body.field] = body.value;

    try {
        const docRef = doc(db, "users", body.id);
        await updateDoc(docRef, updateData);
        res.send("Success");
    } catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).send("Unexpected error occurred");
    }
});


app.listen(3000, () => console.log("Server ready on port 3000."));


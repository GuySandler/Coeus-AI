import "jsr:@std/dotenv/load";
// Deno.env.get()
import express from "npm:express";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import cors from "npm:cors";
import { GenerativeModel } from "@google/generative-ai";

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
	// course id and grade course id are not the same
	const body = req.body;
	// api key
	// future: URL
	if (!body.key) {
		res.status(400).send("Key is required.");
		return;
	}

	const RawBody = await get(`https://acalanes.instructure.com/api/v1/courses`, body.key, {per_page: 25});
	// console.log(await RawBody);
	// get courses and enrollments
	const courses = [];
	const enrollments = [];
	// const todo = [];
	for (const course of RawBody) {
		if (!course.name) {continue}

		courses.push({
			id: course.id,
			name: course.name,
			account_id: course.account_id,
		});

		// const RawCourseAssignments = await get(`https://acalanes.instructure.com/api/v1/courses/${course.id}/assignments`, body.key);

		// for (const assignment of RawCourseAssignments) {
		// 	// add if !has_submitted_submissions or allowed_attempts > 0 or "submission_types": ["external_tool"] has external_tool
		// 	if (
		// 		!assignment.has_submitted_submissions &&
		// 		assignment.allowed_attempts > 0
		// 	) {
		// 		todo.push({
		// 			course_id: course.id,
		// 			assignment_id: assignment.id,
		// 			assignment_name: assignment.name,
		// 			due_at: assignment.due_at,
		// 		});
		// 	}
		// }
	}

	const RawEnrollments = await get(`https://acalanes.instructure.com/api/v1/users/self/enrollments`, body.key, {per_page: 100});
	for (const enrollment of RawEnrollments) {
		if (!enrollment.grades.current_score) {
			continue;
		}
		enrollments.push({
			course_id: enrollment.id,
			grade: enrollment.grades.current_score,
		});
	}

	// res.json({
	// 	courses: courses,
	// 	enrollments: enrollments,
	// 	todo: todo,
	// });

	// console.log(courses);
	// console.log(enrollments);
	// // console.log(todo);
	// res.status(200).send("Success");
	// return {courses: courses, enrollments: enrollments, todo: todo};
	res.json({
		courses: courses,
		grades: enrollments,
	});
});


app.listen(3000, () => console.log("Server ready on port 3000."));


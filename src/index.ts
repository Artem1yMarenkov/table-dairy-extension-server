import Fastify, { FastifyRequest, RequestGenericInterface } from "fastify";
import cors from '@fastify/cors'
import fs from "fs";
import { FollowResponse, https } from "follow-redirects";
import xlsx from "xlsx";
import { IncomingMessage } from "webpack-dev-server";

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

interface IReqBody extends RequestGenericInterface {
	Body: {
		link: string;
		cookie: string;
	};
}

const app = Fastify({
	logger: true,
	https: {
		cert: fs.readFileSync("cert.pem"),
		key: fs.readFileSync("key.pem"),
	},
});

app.register(cors, {
	origin: (origin, callback) => {
		callback(null, true);
	}
});

app.addHook("onRequest", (req, res, done) => {
	req.headers['Content-Type'] = 'application/json';
	done();
})

app.post<IReqBody>("/table", async (req, res) => {
	const body = req.body;

	const link = body?.link;
	const cookie = body?.cookie;
	const url = new URL(link);

	const fileName = `${cookie}-${new Date()}.xls`;
	const file = fs.createWriteStream(fileName);

	const downloadFile = await new Promise<IncomingMessage & FollowResponse>(
		(resolve, reject) => {
			const response = https.get(
				{
					host: url.hostname,
					path: url.pathname,
					headers: {
						cookie: cookie,
						"user-agent": req.headers["user-agent"],
					},
					followRedirects: false
				}
			);

			response.on("response", (response) => {
				resolve(response as IncomingMessage & FollowResponse);
			});

			response.on("error", (err) => {
				reject(err);
			})
		}
	);

	await new Promise((resolve, reject) => {
		const pipeFile = downloadFile.pipe(file);

		pipeFile.on("finish", () => {
			file.close();
			resolve(true);
		});

		pipeFile.on("error", (err) => {
			reject(err);
		});
	});


	let html;
	try {
		const xlsFile = xlsx.read(fs.readFileSync(fileName));
		const worksheet = xlsFile.Sheets["Выписка оценок"];
		html = xlsx.utils.sheet_to_html(worksheet);
	} catch {
		res.status(400)
		return {
			status: 500,
			message: "Save File Error",
			html: null
		}
	}

	fs.unlinkSync(fileName);

	return {
		status: 200,
		message: null,
		html: html,
	};
});

const bootstrap = async () => {
	try {
		const port = 5500;
		app.listen({ 
			port: port,
			host: "0.0.0.0"
		});
		console.info(`Server is running on https://localhost:${port}`);
	} catch (error) {
		app.log.error(error);
		process.exit(1);
	}
};

bootstrap();

import Fastify, { RequestGenericInterface } from "fastify";
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
		cert: fs.readFileSync("1cert.pem"),
		key: fs.readFileSync("1key.pem"),
	},
});

app.post<IReqBody>("/table", async (req) => {
	const { link } = req.body;
	const cookie = req.headers["cookie"];
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
						cookie: req.headers["cookie"],
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


	const xlsFile = xlsx.read(fs.readFileSync(fileName));
	const worksheet = xlsFile.Sheets["Выписка оценок"];

	const html = xlsx.utils.sheet_to_html(worksheet);

	fs.unlinkSync(fileName);

	return {
		status: 200,
		html: html,
	};
});

const bootstrap = async () => {
	try {
		const port = 3000;
		app.listen({ port });
		console.info(`Server is running on http://localhost:${port}`);
	} catch (error) {
		app.log.error(error);
		process.exit(1);
	}
};

bootstrap();

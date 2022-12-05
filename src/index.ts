import Fastify, { RequestGenericInterface } from "fastify";
import fs from "fs";
import { FollowResponse, http, https } from "follow-redirects";
import xlsx, { readFile } from "xlsx";
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

app.post<IReqBody>("/table", async (req, res) => {
    const { link, cookie } = req.body;
    const url = new URL(link);

    const fileName = `${cookie}-${new Date()}.xls`;
    const file = fs.createWriteStream(fileName);

    const response = await new Promise<IncomingMessage & FollowResponse>(
        (resolve, reject) => {
            https.get(
                {
                    hostname: url.hostname,
                    pathname: url.pathname,
                    headers: {
                        cookie: req.headers["cookie"],
                        "User-Agent": req.headers["user-agent"],
                    },
                },
                (response) => {
                    resolve(response);
                }
            );
        }
    );

    response.pipe(file);
    file.close();

    const xlsFile = xlsx.read(fs.readFileSync(fileName));
    const worksheet = xlsFile.Sheets["Выписка оценок"];

    const html = xlsx.utils.sheet_to_html(worksheet);

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

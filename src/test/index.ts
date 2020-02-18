import * as express from "express";
import ObjectExchangeServer from "../ObjectExchangeServer"


const app = express();

app.use((new ObjectExchangeServer()).router);

app.listen(8080, () => console.log(`object-exchange-server listening on port 8080!`))
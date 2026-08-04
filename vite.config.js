import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import {fileURLToPath} from "url";

const __dirname=path.dirname(
	fileURLToPath(import.meta.url)
);

export default defineConfig({

	plugins:[
		react()
	],

	resolve:{
		alias:{
			"@":path.resolve(__dirname,"src"),
			"@components":path.resolve(__dirname,"src/components"),
			"@pages":path.resolve(__dirname,"src/pages"),
			"@config":path.resolve(__dirname,"src/config"),
			"@services":path.resolve(__dirname,"src/services"),
			"@store":path.resolve(__dirname,"src/store"),
			"@utils":path.resolve(__dirname,"src/utils"),
			"@hooks":path.resolve(__dirname,"src/hooks"),
			"@assets":path.resolve(__dirname,"src/assets"),
			"@data":path.resolve(__dirname,"src/data")
		}
	}

});
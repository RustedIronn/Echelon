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
			"@store":path.resolve(__dirname,"src/store"),
			"@utils":path.resolve(__dirname,"src/utils"),
			"@hooks":path.resolve(__dirname,"src/hooks"),
			"@assets":path.resolve(__dirname,"src/assets"),
			"@data":path.resolve(__dirname,"src/data"),
			"@features":path.resolve(__dirname,"src/features"),
			"@core":path.resolve(__dirname,"src/core"),
			"@ui":path.resolve(__dirname,"src/ui")
		}
	}

});
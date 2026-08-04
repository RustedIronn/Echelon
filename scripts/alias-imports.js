import fs from "fs";
import path from "path";

const aliases={
	"../../components":"@components",
	"../components":"@components",
	"../../store":"@store",
	"../store":"@store",
	"../../utils":"@utils",
	"../utils":"@utils",
	"../../hooks":"@hooks",
	"../hooks":"@hooks",
	"../../assets":"@assets",
	"../assets":"@assets",
	"../../data":"@data",
	"../data":"@data"
};


function walk(dir){

	for(const file of fs.readdirSync(dir)){

		const full=path.join(dir,file);

		if(fs.statSync(full).isDirectory()){

			walk(full);

		}else if(
			full.endsWith(".jsx") ||
			full.endsWith(".js")
		){

			let code=fs.readFileSync(
				full,
				"utf8"
			);


			for(const oldPath in aliases){

				code=code.replaceAll(
					`from "${oldPath}`,
					`from "${aliases[oldPath]}`
				);

				code=code.replaceAll(
					`from '${oldPath}`,
					`from '${aliases[oldPath]}`
				);

			}


			fs.writeFileSync(
				full,
				code
			);

			console.log("Updated:",full);

		}

	}

}


walk("./src");
const fs = require("fs");
const archiver = require("archiver");

const prefix = "windows_taskbar_unread_badge"
const suffix = "tb-windows"
const manifest = JSON.parse(fs.readFileSync("src/manifest.json"));
const version = manifest["version"]
const outname = "/xpi/" + prefix + "-" + version + "-" + suffix + ".xpi";

fs.mkdirSync(__dirname + "/xpi", { recursive: true });

const output = fs.createWriteStream(__dirname + outname);
const archive = archiver("zip", {});

archive.on("end", function() {
  console.log(archive.pointer() + " total bytes written to " + outname);
});

archive.on("error", function(err) {
  throw err;
});

archive.pipe(output);
archive.file('LICENSE');
archive.directory("src/", false);
archive.finalize();


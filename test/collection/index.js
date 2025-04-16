import { describe } from "node:test";
import { defineInsertOne } from "./insertOne.js";
import { defineInsertMany } from "./insertMany.js";
import { defineDeleteOne } from "./deleteOne.js";
import { defineUpdateOne } from "./updateOne.js";
import { defineUpdateMany } from "./updateMany.js";
import { defineReplaceOne } from "./replaceOne.js";
import { defineDistinct } from "./distinct.js";
import { defineFindOne } from "./findOne.js";
import { defineFind } from "./find.js";
import { defineAggregate } from "./aggregate.js";
import { defineDeleteMany } from "./deleteMany.js";
import { defineCount } from "./count.js";
import { defineCountDocuments } from "./countDocuments.js";
import { defineEstimatedDocumentCount } from "./estimatedDocumentCount.js";
import { defineFindOneAndUpdate } from "./findOneAndUpdate.js";
import { defineFindOneAndReplace } from "./findOneAndReplace.js";
import { defineFindOneAndDelete } from "./findOneAndDelete.js";
import { defineChangeArgs } from "./changeArgs.js";
import { defineInstrument } from "./instrument.js";

describe.only("collection", () => {
  defineInsertOne();
  defineInsertMany();
  defineDeleteOne();
  defineDeleteMany();
  defineReplaceOne();
  defineUpdateOne();
  defineUpdateMany();
  defineDistinct();
  defineFindOne();
  defineFind();
  defineAggregate();
  defineCount();
  defineCountDocuments();
  defineEstimatedDocumentCount();
  defineFindOneAndUpdate();
  defineFindOneAndReplace();
  defineFindOneAndDelete();
  defineChangeArgs();
  defineInstrument();
});

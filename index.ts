import babylon from 'babylon'
import traverse from 'babel-traverse'
import {transformFromAst} from 'babel-core'
import * as fs from 'fs'
import * as path from 'path'

let ID = 0

interface Asset {
    id: number;
    filename: string;
    code?: string;
    dependecies: string[];
    mapping?: Record<string, number>
}

type Graph = Asset[]

function createAsset(filename: string): Asset {
    const content = fs.readFileSync(filename, 'utf-8')

    const ast = babylon.parse(content, {
        sourceType: 'module'
    })

    const dependecies: string[] = []

    traverse(ast, {
        ImportDeclaration({node}) {
            dependecies.push(node.source.value)
        }
    })

    const id = ID++

    const {code} = transformFromAst(ast, undefined, {
        presets: ['env']
    })

    return {
        id,
        filename,
        code,
        dependecies
    }
}

// console.log(createAsset('./example/entry.js'))

function createGraph(entry: string): Graph {
    const mainAsset = createAsset(entry)

    const queue: Asset[] = [mainAsset]

    for (const asset of queue) {
        asset.mapping = {}

        const dirname = path.dirname(asset.filename);

        asset.dependecies.forEach(relativePath => {
            const absolutePath = path.join(dirname, relativePath)
            const child = createAsset(absolutePath)

            asset.mapping![relativePath] = child.id

            queue.push(child)
        })
    }

    return queue
}

// console.log(createGraph('./example/entry.js'))

function bundle(graph: Graph) {
    let modules = ''

    graph.forEach(mod => {
        modules += `${mod.id}: [
            function(require, module, exports) {
                ${mod.code}
            },
            ${JSON.stringify(mod.mapping)}
        ],
        `
    })

    const result = `(function(modules){
        function require(id) {
            const [fn, mapping] = modules[id]

            function localRequire(name) {
                return require(mapping[name])
            }

            const module = { exports: {} }

            fn(localRequire, module, module.exports)

            return module.exports
        }

        require(0)
    })({${modules}})`


    return result
}

console.log(bundle(createGraph('example/entry.js')))
//import * as Chance from 'chance'


let Immutable = require('immutable')

let faker = require('faker')
let Chance = require('chance')
const chance = new Chance()

import * as utils from './utils/index.ts'
import pluralize from './utils/pluralizator.ts'
import * as iterator from './utils/iterator.ts'

export default class Mocker {

    public config: Immutable.Map<string, number>
    public data = {}
    public entity = {}
    public initialData = null
    public path = []
    public virtual = false
    public virtualPaths = []
    private entityOutputName = ''
    private entityName = ''

    constructor(config: any) {
        this.config = Immutable.fromJS(config)
    }

    generate(entity: string, options: any) {
        let entityPlural = pluralize(entity)
        this.entityOutputName = entityPlural
        this.entityName = entity
        this.data[entityPlural] = []
        this.initialData = {}

        return new Promise((resolve, reject) => {
            let finalCb = () => {
                resolve(this.data)
            }

            try {
                if ((Number as any).isInteger(options)){

                    utils.repeatFN( options,
                        (nxt) => {
                            let cfg = this.config.toJS()
                            if (utils.iamLastParent(cfg[entity])) {
                                this.generator(cfg[entity], (data) => {
                                    this.data[this.entityOutputName].push(data)
                                    nxt()
                                })
                            } else {
                                this.generateEntity(cfg[entity], (data) => {
                                    this.data[this.entityOutputName].push(data)
                                    nxt()
                                })
                            }
                        },
                        finalCb
                    )
                } else {

                    let cfg = this.config.toJS()
                    let f = options.uniqueField
                    let possibleValues
                    if (f === '.') {
                        possibleValues = cfg[entity].values
                    } else {
                        possibleValues = cfg[entity][f].values
                    }

                    let length = possibleValues.length

                    utils.eachSeries(
                        possibleValues,
                        (k, nxt) => {
                            let cfg = this.config.toJS()

                            if (f === '.') {
                                this.data[this.entityOutputName].push(k)
                                return nxt()
                            }

                            cfg[entity][f] = {static: k}


                            this.generateEntity(cfg[entity], (data) => {
                                this.data[this.entityOutputName].push(data)
                                nxt()
                            })
                        },
                        finalCb
                    )
                }
            } catch (e){
                console.log('Exception: mocker-data-generator')
                console.log('Error generating ' + entityPlural + ' : ' + e)
                console.log(e.stack)
                reject(e)
            }
        })
    }

    generateEntity(entityConfig: Object, cb) {

        this.entity = (Object as any).assign({}, entityConfig)
        let proccessNode = (obj, k, value) => {
            return new Promise((resolve, reject) => {
                this.generator(value, (fieldCalculated) => {
                    if (!utils.isConditional(k)){
                        obj[k] = fieldCalculated
                    } else {
                        let key = k.split(',')
                        if (utils.evalWithContextData(key[0], this.entity)){
                            obj[key[1]] = fieldCalculated
                            delete obj[k]
                        } else {
                            delete obj[k]
                        }
                    }
                    resolve(fieldCalculated)
                })
            })
        }

        let it = iterator.it(this.entity);


        let res = {
            done: false,
            value:{
                obj: {},
                k:'',
                value: '',
                path: []
            }
        }
        while(res.value){
            res = it.next();
            if (!res.value) break
            let {obj, k, value} = res.value;
            proccessNode(obj, k, value);
        }

        cb(this.entity)
    }

    generator(field, cb) {
        if ( utils.isArray(field) ){
            let fieldConfig = field[0]
            let arrayConfig = field[1]
            let array = []
            let length = utils.fieldArrayCalcLength(arrayConfig)
            for (let i = 0; i < length; i++) {
                array.push(this.generateNormalField(fieldConfig))
            }
            cb(array)
        } else {
            cb(this.generateNormalField(field))
        }
    }

    generateNormalField(config) {
        let object = this.entity
        let db = this.data

        if (config.faker){
            return utils.stringToFn('faker', config.faker, db, object)
        } else if (config.chance) {
            return utils.stringToFn('chance', config.chance, db, object)
        } else if (config.values) {
            return (faker as any).random.arrayElement(config.values)
        } else if (config.function) {
            return config.function.call({object, faker, chance, db})
        } else if (config.static) {
            return config.static
        } else if (config.hasOwnProperty('incrementalId')) {
            return parseInt(db[this.entityOutputName].length) + parseInt(config.incrementalId)
        } else {
            return null
        }
    }

}

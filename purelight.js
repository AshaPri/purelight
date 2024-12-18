import Joi from 'joi'
import postgresConnector from '../connectors/postgresConnector.js'
import axios from 'axios'
import ProductImportService, {
    calculateTimeDifferenceInSeconds,
} from '../services/productImportService.js'
import { s3Upload } from '../commons/s3fileUpload.js'
import moment from 'moment'

export default async (req, h) => {
    try {
        const productImportService = new ProductImportService()
        const models = await postgresConnector.getModels()
        let user = await models.users.findOne({
            where: {
                email: 'info@pldiam.com',
            },
        })

        const companyId = user.companyid
        const userId = user.id
        let pageNumber = 1
        let callApi = true
        while (callApi) {
            try {
                let modifiedUrl = `https://api.pldiam.com/api/diamond/diamond-list?page=${pageNumber}`
                const { data } = await axios.post(modifiedUrl, {
                    TOKEN_NO: '2a68883c-d383-49da-a177-fe96bf630fcc',
                    COMP_GUID: '06e2152b-8542-40a7-a867-974eef158b98',
                    USER_SEQ: 2434,
                    LOGIN_USER_SEQ: 2434,
                    STOCK_TYPE: 'LIST',
                    // START: '0',
                    // END: '100000',
                    SORTBY: null,
                    DRAW: 0,
                    SAVE_HISTORY: true,
                })
                const date = moment(new Date()).format('DD-MM-YYYY')
                const vendorFile = `purelight-${date}.json`
                s3Upload(data.data, vendorFile)
                const startDate = new Date().toISOString()
                const startTime = new Date().getTime()

                let rows = []
                if (data.data.length > 0) {
                    data.data.forEach((data) => {
                        rows.push({
                            reference_no: data['PACKET_NO'],
                            productPrimaryKey: data['PACKET_NO']
                                .toLowerCase()
                                .trim(),
                            status: data.STATUS,
                            shape: data.SHAPE,
                            carat: data.CARAT,
                            cert_no: data.REPORT_NO,
                            category: 'LAB_DIAMONDS',
                            color: data.COLOR,
                            clarity: data.CLARITY,
                            cut: data.CUT,
                            polish: data.POLISH,
                            symmetry: data.SYMM,
                            fluorescence_intensity: data.FLS,
                            fluorescence_color: data.FLS_COLOR,
                            measurement: data.MEASUREMENT,
                            shade: data.SHADE,
                            milky: data.MILKY,
                            supplier: 'Pure Light Diamond-inhouse',
                            country: 'INDIA',
                            eye_clean: data.EYE_CLEAN,
                            lab: data.LAB,
                            report: data.REPORT_NO,
                            location: data.LOCATION,
                            price_per_carat: data.NET_RATE,
                            price: data.NET_VALUE,
                            depth: data.DEPTH_PER,
                            table: data.TABLE_PER,
                            girdle_thin: data.GIRDLE_THIN,
                            girdle_thick: data.GIRDLE_THICK,
                            girlde_percentage: data.GIRDLE_PER,
                            cutlet_size: data.CULET,
                            cutlet_condition: data.CULET_CONDITION,
                            crown_height: data.CR_HEIGHT,
                            crown_angle: data.CR_ANGLE,
                            pavilion_depth: data.PAV_HEIGHT,
                            pavilion_angle: data.PAV_ANGLE,
                            inscription: data.LASER_INSCRIPTION,
                            cert_comment: data.REPORT_COMMENT,
                            cert_comments: data.KEY_TO_SYMBOLS,
                            white_inclusion: data.WHITE_INCL,
                            //black_inclusion: data.blackInclusion,
                            open_inclusion: data.OPEN_INCL,
                            fancy_color: data.FANCY_COLOR,
                            //fancy_color_intensity: data.fancyIntensity,
                            //fancy_color_overtone: data.fancyOvertone,
                            cert_image: data.CERTI_LINK,
                            diamond_video: data.VIDEO_LINK,
                            //rapnet_price: data.rapprice,
                            discount: data.DISCOUNT,
                        })
                    })

                    await productImportService.uploadDiamondProductToDb({
                        userId,
                        companyId,
                        rows,
                        fileName: 'Pure Light Diamond',
                        addOrReplace: 'add_or_update',
                        productType: 'diamonds',
                        startTime: new Date(),
                        isFirstIteration: pageNumber == 1 ? true : false,
                    })

                    let duration = calculateTimeDifferenceInSeconds({
                        startTime: startTime,
                        endTime: new Date().getTime(),
                    })

                    await models.import_info.create({
                        upload_date: startDate,
                        duration,
                        status: 'Successfull',
                        upload_method: 'API',
                        stone_recieved: data.data.length,
                        valid_stones: data.data.length,
                        invalid_stones: 0,
                        products_added: data.data.length,
                        products_updated: 0,
                        products_variants_added: data.data.length,
                        products_variants_updated: 0,
                        vendor_id: userId,
                        product_type: 'diamonds',
                        on_hold: 0,
                        import_mode: 'API',
                        companyid: companyId,
                        s3filepath: `/importfiles/${vendorFile}`,
                    })
                    console.log(pageNumber)
                    pageNumber = pageNumber + 1
                } else {
                    callApi = false
                }
            } catch (err) {
                console.log(err)
            }
        }
        return 'done'
    } catch (err) {
        console.log(err)
    }
}

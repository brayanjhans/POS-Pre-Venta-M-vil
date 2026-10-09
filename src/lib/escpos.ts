import { Order } from '../types/pos';

export interface EscPosOptions {
  paperWidth: '58mm' | '80mm';
  storeName?: string;
  storeRuc?: string;
  storeAddress?: string;
}

export class EscPosBuilder {
  private buffer: number[] = [];
  private readonly maxChars: number;

  constructor(paperWidth: '58mm' | '80mm' = '58mm') {
    this.maxChars = paperWidth === '58mm' ? 32 : 48;
    this.init();
  }

  // Inicializa la impresora (ESC @)
  init(): this {
    this.buffer.push(0x1B, 0x40);
    return this;
  }

  // Alineación: 0 = Izquierda, 1 = Centro, 2 = Derecha (ESC a n)
  align(alignment: 'left' | 'center' | 'right'): this {
    const val = alignment === 'left' ? 0x00 : alignment === 'center' ? 0x01 : 0x02;
    this.buffer.push(0x1B, 0x61, val);
    return this;
  }

  // Negrita (ESC E n)
  bold(enable: boolean): this {
    this.buffer.push(0x1B, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  // Tamaño de texto: normal o grande (GS ! n)
  size(size: 'normal' | 'double' | 'title'): this {
    let byte = 0x00;
    if (size === 'double') byte = 0x11; // 2x width & 2x height
    if (size === 'title') byte = 0x22;  // 3x width & 3x height
    this.buffer.push(0x1D, 0x21, byte);
    return this;
  }

  // Agregar texto crudo mapeado a Code Page 437 (estándar ESC/POS para impresoras térmicas)
  text(str: string): this {
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      // Mapeo de caracteres del español Unicode → Code Page 437
      switch (c) {
        case 225: this.buffer.push(0xA0); break; // á
        case 233: this.buffer.push(0x82); break; // é
        case 237: this.buffer.push(0xA1); break; // í
        case 243: this.buffer.push(0xA2); break; // ó
        case 250: this.buffer.push(0xA3); break; // ú
        case 241: this.buffer.push(0xA4); break; // ñ
        case 209: this.buffer.push(0xA5); break; // Ñ
        case 193: this.buffer.push(0x41); break; // Á → A (sin equivalente CP437)
        case 201: this.buffer.push(0x45); break; // É → E
        case 205: this.buffer.push(0x49); break; // Í → I
        case 211: this.buffer.push(0x4F); break; // Ó → O
        case 218: this.buffer.push(0x55); break; // Ú → U
        case 252: this.buffer.push(0x81); break; // ü
        case 220: this.buffer.push(0x9A); break; // Ü
        case 191: this.buffer.push(0xA8); break; // ¿
        case 161: this.buffer.push(0xAD); break; // ¡
        default:  this.buffer.push(c & 0xFF);    break;
      }
    }
    return this;
  }

  // Agregar salto de línea (LF)
  line(str: string = ''): this {
    if (str) this.text(str);
    this.buffer.push(0x0A);
    return this;
  }

  // Línea divisoria continua o de guiones
  separator(char: string = '-'): this {
    return this.line(char.repeat(this.maxChars));
  }

  // Fila formateada de 2 columnas (Izquierda y Derecha ajustados)
  row2Col(left: string, right: string): this {
    const spaceCount = this.maxChars - left.length - right.length;
    if (spaceCount > 0) {
      return this.line(left + ' '.repeat(spaceCount) + right);
    }
    return this.line(`${left} ${right}`);
  }

  // Fila de 3 columnas para productos (Cant/Pres, Desc, Subt)
  // Ej: "1x PAQ Inka Kola 500ml     25.00"
  itemRow(qtyPres: string, name: string, price: string): this {
    const rightCol = price;
    const availableForName = this.maxChars - qtyPres.length - rightCol.length - 2;
    const truncatedName = name.length > availableForName ? name.substring(0, availableForName) : name;
    const spaces = this.maxChars - (qtyPres.length + 1 + truncatedName.length + rightCol.length);
    return this.line(`${qtyPres} ${truncatedName}${' '.repeat(Math.max(1, spaces))}${rightCol}`);
  }

  // Secuencia nativa ESC/POS para Código QR (Comando GS ( k)
  qrCode(data: string, moduleSize: number = 6): this {
    const storeLen = data.length + 3;
    const pL = storeLen & 0xFF;
    const pH = (storeLen >> 8) & 0xFF;

    // 1. Definir Modelo 2 (GS ( k 4 0 49 65 50 0)
    this.buffer.push(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);

    // 2. Definir Tamaño de Módulo (GS ( k 3 0 49 67 size)
    this.buffer.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, Math.min(moduleSize, 12));

    // 3. Nivel de corrección de error 'M' (GS ( k 3 0 49 69 49)
    this.buffer.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31);

    // 4. Almacenar datos en el buffer de la impresora (GS ( k pL pH 49 80 48 d1...dk)
    this.buffer.push(0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30);
    for (let i = 0; i < data.length; i++) {
      this.buffer.push(data.charCodeAt(i) & 0xFF);
    }

    // 5. Imprimir el código QR almacenado (GS ( k 3 0 49 81 48)
    this.buffer.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);
    return this;
  }

  // Cortar papel (GS V 66 n) y alimentar 3 líneas
  cut(): this {
    this.buffer.push(0x0A, 0x0A, 0x0A);
    this.buffer.push(0x1D, 0x56, 0x42, 0x00);
    return this;
  }

  // Retorna el Uint8Array binario listo para enviar al socket Bluetooth
  toBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  // Retorna representación Hex para depuración
  toHexString(): string {
    return this.buffer.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  }
}

/**
 * Generador completo del ticket de Pre-Venta con el Código QR obligatorio
 */
export function buildPreSaleTicketEscPos(order: Order, options: EscPosOptions): Uint8Array {
  const b = new EscPosBuilder(options.paperWidth);

  // Encabezado
  b.align('center')
   .bold(true)
   .size('double')
   .line(options.storeName || 'DISTRIBUIDORA GOLOSINAS')
   .size('normal')
   .bold(false)
   .line(options.storeRuc ? `RUC: ${options.storeRuc}` : 'DISTRIBUCION & MAYORISTA')
   .line(options.storeAddress || 'Av. Los Próceres 840 - Almacén Central')
   .separator('=');

  // Identificador del Pedido y Datos de Pre-Venta
  b.bold(true)
   .size('double')
   .line(`*** PRE-VENTA ***`)
   .line(order.id)
   .size('normal')
   .bold(false)
   .line(`ESTADO: ${order.status}`)
   .line(`FECHA: ${new Date(order.createdAt).toLocaleString('es-PE')}`)
   .line(`VENDEDOR: ${order.sellerName}`)
   .separator('-');

  // Cabecera de Ítems
  b.align('left')
   .bold(true)
   .line(options.paperWidth === '58mm' ? 'CANT PRES DESCRIPCION    SUBT' : 'CANT PRES  DESCRIPCION PRODUCTO           SUBTOTAL')
   .bold(false)
   .separator('-');

  // Detalle de Ítems
  order.items.forEach(item => {
    const qtyTag = `${item.quantity} ${item.presentationType.toUpperCase()}`;
    const priceStr = `S/ ${item.subtotal.toFixed(2)}`;
    b.itemRow(qtyTag, item.productName, priceStr);
    // Subtexto con desglose de unidades base
    b.align('left')
     .text(`   [x${item.conversionFactor}u = ${item.baseUnitsDeducted} unds base | P.U: S/ ${item.unitPrice.toFixed(2)}]`)
     .line();
  });

  b.separator('=');

  // Total
  b.align('right')
   .bold(true)
   .size('double')
   .line(`TOTAL: S/ ${order.totalAmount.toFixed(2)}`)
   .size('normal')
   .bold(false)
   .line(`Items: ${order.items.length} | Unds Base Totales: ${order.totalBaseUnits}`)
   .separator('-');

  // SECCIÓN CRÍTICA: Código QR para escaneo en Caja
  b.align('center')
   .bold(true)
   .line('LLEVE ESTE TICKET A CAJA')
   .line('EL CAJERO ESCANEARA ESTE QR:')
   .line();

  // Imprimir QR nativo con el ID de la Pre-Venta
  b.qrCode(order.qrPayload || order.id, options.paperWidth === '58mm' ? 6 : 8);

  b.line()
   .bold(true)
   .size('double')
   .line(order.id)
   .size('normal')
   .bold(false)
   .line('** NO VALIDO COMO COMPROBANTE FISCAL **')
   .line('Pague en Caja para emitir Boleta/Factura')
   .cut();

  return b.toBytes();
}

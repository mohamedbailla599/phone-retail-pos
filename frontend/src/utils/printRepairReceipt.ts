import type { RepairTicket } from '../api/repairs';
import {
  printThermalReceipt,
  getReceiptStoreInfo,
  generateBarcodeSvg,
  renderReceiptHeader,
} from './printReceipt';

const ISSUE_TYPE_FR: Record<string, string> = {
  SCREEN: 'Écran / Vitre cassée',
  BATTERY: 'Batterie / Autonomie',
  CHARGING_PORT: 'Connecteur de charge / Port',
  BACK_GLASS: 'Vitre arrière / Châssis',
  CAMERA: 'Caméra / Lentille',
  WATER_DAMAGE: 'Oxydation / Dégât des eaux',
  SPEAKER_MIC: 'Micro / Haut-parleur / Écouteur',
  SOFTWARE: 'Système / Déblocage / Flash',
  MOTHERBOARD: 'Carte Mère / Micro-soudure',
  OTHER: 'Autre panne / Diagnostic global',
};

export function printRepairIntakeReceipt(ticket: RepairTicket) {
  const storeInfo = getReceiptStoreInfo();
  const storeName = storeInfo.storeName;
  const currency = storeInfo.currency;
  const footerMessage = storeInfo.footerMessage;
  const disclaimer = storeInfo.disclaimer;

  const dateStr = new Date(ticket.created_at).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const estDateStr = ticket.estimated_completion_date
    ? new Date(ticket.estimated_completion_date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : 'À confirmer';

  const estCost = parseFloat(ticket.estimated_cost) || 0;
  const deposit = parseFloat(ticket.deposit_paid) || 0;
  const balance = Math.max(0, estCost - deposit);

  const operatorName =
    (ticket as any).created_by_name ||
    ticket.created_by_username ||
    'Atelier';

  const issueLabel =
    ISSUE_TYPE_FR[ticket.issue_type] ||
    ticket.issue_type_display ||
    ticket.issue_type;

  const ticketBarcodeSvg = generateBarcodeSvg(ticket.ticket_number, 32, 1.25);

  const html = `
    <!-- ============================================== -->
    <!-- VOLET 1 : EXEMPLAIRE CLIENT (REÇU DE DÉPÔT)    -->
    <!-- ============================================== -->
    <div class="ticket-section">
      ${renderReceiptHeader('Service Maintenance & Réparation')}

      <div class="text-center my-2 border-box">
        <div class="text-xxs uppercase tracking-wider font-bold">TICKET DE DÉPÔT / RÉCEPTION</div>
        <div class="text-base font-bold font-mono">${ticket.ticket_number}</div>
        <div class="barcode-container my-1">${ticketBarcodeSvg}</div>
        <div class="text-xxs">Date de dépôt: ${dateStr}</div>
      </div>

      <div class="border-b-dotted py-1 text-xs">
        <div class="flex justify-between">
          <span class="font-bold">Client:</span>
          <span>${ticket.customer_name}</span>
        </div>
        <div class="flex justify-between">
          <span class="font-bold">Tél:</span>
          <span class="font-mono">${ticket.customer_phone}</span>
        </div>
        <div class="flex justify-between">
          <span class="font-bold">Pris en charge par:</span>
          <span>${operatorName}</span>
        </div>
      </div>

      <div class="border-b-dotted py-1 text-xs">
        <div class="font-bold uppercase text-xxs text-left mb-1">DÉTAILS DE L'APPAREIL</div>
        <div class="flex justify-between">
          <span>Appareil:</span>
          <span class="font-bold">${ticket.device_brand} ${ticket.device_model}</span>
        </div>
        ${
          ticket.device_color
            ? `
        <div class="flex justify-between">
          <span>Couleur:</span>
          <span>${ticket.device_color}</span>
        </div>`
            : ''
        }
        ${
          ticket.imei_or_serial
            ? `
        <div class="flex justify-between">
          <span>IMEI / S/N:</span>
          <span class="font-bold font-mono text-xxs">${ticket.imei_or_serial}</span>
        </div>`
            : ''
        }
        ${
          ticket.passcode
            ? `
        <div class="flex justify-between">
          <span>Code / Schéma:</span>
          <span class="font-mono text-xxs text-muted">•••• (Enregistré sécurisé)</span>
        </div>`
            : ''
        }
      </div>

      <div class="border-b-dotted py-1 text-xs">
        <div class="font-bold uppercase text-xxs text-left mb-1">PANNE DÉCLARÉE</div>
        <div class="flex justify-between">
          <span>Catégorie:</span>
          <span class="font-bold">${issueLabel}</span>
        </div>
        ${
          ticket.issue_description
            ? `
        <div class="mt-1 text-left text-xxs bg-gray-100 p-1 rounded">
          <span class="font-bold">Symptômes : </span>${ticket.issue_description}
        </div>`
            : ''
        }
      </div>

      <div class="border-b-dashed py-1 text-xs">
        <div class="flex justify-between py-05">
          <span>Coût estimatif:</span>
          <span class="font-bold">${estCost.toFixed(2)} ${currency}</span>
        </div>
        <div class="flex justify-between py-05">
          <span>Acompte versé:</span>
          <span class="font-bold">${deposit.toFixed(2)} ${currency}</span>
        </div>
        <div class="flex justify-between py-05 border-b-dotted font-bold">
          <span>Reste à payer:</span>
          <span>${balance.toFixed(2)} ${currency}</span>
        </div>
        <div class="flex justify-between py-05 text-xxs mt-1">
          <span>Date prévue:</span>
          <span class="font-bold">${estDateStr}</span>
        </div>
      </div>

      <div class="text-xxs text-center mt-2 px-1">
        <p class="font-bold whitespace-pre-line mb-1">${footerMessage}</p>
        <p class="font-bold mb-05 text-[10px]">CONDITIONS GÉNÉRALES :</p>
        <p>1. La présentation de ce ticket original est obligatoire pour retirer l'appareil.</p>
        <p>2. L'atelier n'est pas responsable de la perte de données (sauvegarde requise préalable).</p>
        <p>3. Tout appareil non retiré après 60 jours sera considéré comme abandonné.</p>
        <p class="text-[9px] text-gray-700 mt-1">${disclaimer}</p>
      </div>

      <div class="mt-2 text-center text-xxs font-bold">
        Conservez précieusement ce ticket
      </div>
    </div>

    <!-- ============================================== -->
    <!-- VOLET 2 : COUPON ATELIER (PAGE SÉPARÉE)        -->
    <!-- ============================================== -->
    <div class="ticket-section page-break pt-2">
      <div class="text-center border-b-dashed pb-2">
        <div class="font-bold text-base uppercase">${storeName}</div>
        <div class="text-xs font-bold uppercase">FICHE ATELIER / SUIVI RÉPARATION</div>
      </div>

      <div class="text-center my-2 border-box">
        <div class="text-xxs uppercase tracking-wider font-bold">COUPON APPAREIL</div>
        <div class="text-base font-bold font-mono">${ticket.ticket_number}</div>
        <div class="barcode-container my-1">${ticketBarcodeSvg}</div>
        <div class="text-xxs">Date de dépôt: ${dateStr}</div>
      </div>

      <div class="border-b-dotted py-1 text-xs">
        <div class="flex justify-between">
          <span class="font-bold">Client:</span>
          <span>${ticket.customer_name}</span>
        </div>
        <div class="flex justify-between">
          <span class="font-bold">Tél:</span>
          <span class="font-mono">${ticket.customer_phone}</span>
        </div>
        <div class="flex justify-between">
          <span class="font-bold">Date prévue:</span>
          <span class="font-bold">${estDateStr}</span>
        </div>
      </div>

      <div class="border-b-dotted py-1 text-xs">
        <div class="font-bold uppercase text-xxs text-left mb-1">APPAREIL & SÉCURITÉ</div>
        <div class="flex justify-between">
          <span>Appareil:</span>
          <span class="font-bold">${ticket.device_brand} ${ticket.device_model}</span>
        </div>
        ${
          ticket.device_color
            ? `
        <div class="flex justify-between">
          <span>Couleur:</span>
          <span>${ticket.device_color}</span>
        </div>`
            : ''
        }
        ${
          ticket.imei_or_serial
            ? `
        <div class="flex justify-between">
          <span>IMEI/SN:</span>
          <span class="font-mono font-bold text-xxs">${ticket.imei_or_serial}</span>
        </div>`
            : ''
        }
        <div class="flex justify-between items-center my-1.5 p-1 border-box" style="background: #fdf6e2;">
          <span class="font-bold">Code / Schéma:</span>
          <span class="font-bold text-sm font-mono">${ticket.passcode || 'Aucun'}</span>
        </div>
      </div>

      <div class="border-b-dotted py-1 text-xs">
        <div class="font-bold uppercase text-xxs text-left mb-1">PANNE SIGNALÉE</div>
        <div><span class="font-bold">Type:</span> ${issueLabel}</div>
        ${
          ticket.issue_description
            ? `
        <div class="mt-1 text-left text-xxs bg-gray-100 p-1.5 rounded">
          <span class="font-bold">Symptômes:</span> ${ticket.issue_description}
        </div>`
            : ''
        }
      </div>

      <div class="py-1 text-xs">
        <div class="flex justify-between py-05">
          <span>Coût estimatif:</span>
          <span class="font-bold">${estCost.toFixed(2)} ${currency}</span>
        </div>
        <div class="flex justify-between py-05">
          <span>Acompte versé:</span>
          <span>${deposit.toFixed(2)} ${currency}</span>
        </div>
        <div class="flex justify-between py-05 font-bold">
          <span>Reste à payer:</span>
          <span>${balance.toFixed(2)} ${currency}</span>
        </div>
      </div>
    </div>
  `;

  printThermalReceipt(html, `Ticket_Depot_${ticket.ticket_number}`);
}

export function printRepairDeliveryReceipt(ticket: RepairTicket) {
  const storeInfo = getReceiptStoreInfo();
  const currency = storeInfo.currency;
  const footerMessage = storeInfo.footerMessage;
  const disclaimer = storeInfo.disclaimer;

  const deliveryDateStr = new Date(ticket.delivered_at || new Date()).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const finalCost = parseFloat(ticket.final_cost) || 0;
  const deposit = parseFloat(ticket.deposit_paid) || 0;
  const remainingPaid = Math.max(0, finalCost - deposit);

  const issueLabel =
    ISSUE_TYPE_FR[ticket.issue_type] ||
    ticket.issue_type_display ||
    ticket.issue_type;

  const ticketBarcodeSvg = generateBarcodeSvg(ticket.ticket_number, 30, 1.25);

  const html = `
    <div class="ticket-section">
      ${renderReceiptHeader('Facture Réparation & Garantie')}

      <div class="text-center my-2 border-box">
        <div class="text-xxs uppercase tracking-wider font-bold">BON DE LIVRAISON APPAREIL</div>
      <div class="text-base font-bold font-mono">${ticket.ticket_number}</div>
      <div class="barcode-container my-1">${ticketBarcodeSvg}</div>
      <div class="text-xxs">Livré le: ${deliveryDateStr}</div>
    </div>

    <div class="border-b-dotted py-1 text-xs">
      <div class="flex justify-between">
        <span class="font-bold">Client:</span>
        <span>${ticket.customer_name}</span>
      </div>
      <div class="flex justify-between">
        <span class="font-bold">Tél:</span>
        <span class="font-mono">${ticket.customer_phone}</span>
      </div>
      <div class="flex justify-between">
        <span class="font-bold">Appareil:</span>
        <span class="font-bold">${ticket.device_brand} ${ticket.device_model}</span>
      </div>
      ${
        ticket.imei_or_serial
          ? `
      <div class="flex justify-between">
        <span>IMEI / S/N:</span>
        <span class="font-bold font-mono text-xxs">${ticket.imei_or_serial}</span>
      </div>`
          : ''
      }
    </div>

    <div class="border-b-dotted py-1 text-xs">
      <div class="font-bold uppercase text-xxs text-left mb-1">TRAVAIL EFFECTUÉ</div>
      <div class="flex justify-between">
        <span>Intervention:</span>
        <span class="font-bold">${issueLabel}</span>
      </div>
      ${
        ticket.technician_notes
          ? `
      <div class="mt-1 text-left text-xxs bg-gray-100 p-1 rounded">
        <span class="font-bold">Note technicien : </span>${ticket.technician_notes}
      </div>`
          : ''
      }
    </div>

    <div class="border-b-dashed py-1 text-xs">
      <div class="flex justify-between py-05">
        <span>Montant Total Réparation:</span>
        <span class="font-bold">${finalCost.toFixed(2)} ${currency}</span>
      </div>
      ${
        deposit > 0
          ? `
      <div class="flex justify-between py-05 text-xxs">
        <span>Acompte initial déduit:</span>
        <span>-${deposit.toFixed(2)} ${currency}</span>
      </div>`
          : ''
      }
      <div class="flex justify-between py-1 border-b-double text-sm font-bold">
        <span>Règlement final reçu:</span>
        <span>${remainingPaid.toFixed(2)} ${currency}</span>
      </div>
      <div class="flex justify-between py-05 text-xxs mt-1">
        <span>Mode de règlement:</span>
        <span class="font-bold">${ticket.payment_method === 'BANK_TRANSFER' ? 'Virement Bancaire' : 'Espèces (Cash)'}</span>
      </div>
    </div>

    <div class="text-center my-2 border-box">
      <div class="text-xs font-bold uppercase text-gold">GARANTIE RÉPARATION : ${ticket.warranty_days} JOURS</div>
      <div class="text-xxs">Couvre les pièces remplacées et la main d'œuvre.</div>
      <div class="text-xxs text-gray-600">Exclut la casse, l'oxydation liquide et les chutes postérieures.</div>
    </div>

    <div class="text-center mt-3 text-xxs space-y-1">
      <p class="font-bold whitespace-pre-line">${footerMessage}</p>
      <p class="text-[9px] text-gray-700">${disclaimer}</p>
    </div>
  `;

  printThermalReceipt(html, `Facture_Reparation_${ticket.ticket_number}`);
}

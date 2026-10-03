import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { Scale, ChevronRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms and Conditions | Erry Imprints',
  description:
    'These terms and conditions outline the rules and regulations for the use of Erry Imprints’s Website, located at www.erryimprints.com.au.',
};

export default function TermsPage() {
  return (
    <div className="bg-slate-50 min-h-screen py-10 lg:py-16 text-slate-800">
      {/* Breadcrumb Navigation */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-900">Terms and Conditions</span>
        </nav>
      </div>

      {/* Hero Header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-8 sm:p-10 shadow-xl border border-slate-800">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <Scale className="w-3.5 h-3.5" />
              <span>Erry Imprints Legal</span>
            </span>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Terms and Conditions
            </h1>
            <p className="text-slate-300 text-sm">
              www.erryimprints.com.au
            </p>
          </div>
        </div>
      </div>

      {/* Content Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-6 sm:p-12 rounded-3xl border border-slate-200 shadow-xs space-y-8 text-sm leading-relaxed text-slate-700">
          {/* Welcome & Introduction */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Welcome to Erry Imprints!</h2>
            <p>
              These terms and conditions outline the rules and regulations for the use of Erry Imprints’s Website, located at www.erryimprints.com.au.
            </p>
            <p>
              By accessing this website, we assume you accept these terms and conditions. Do not continue to use Erry Imprints if you do not agree to take all the terms and conditions stated on this page.
            </p>
            <p>
              The following terminology applies to these Terms and Conditions, Privacy Statement and Disclaimer Notice and all Agreements: “Client”, “You” and “Your” refers to you, the person log on this website and compliant to the Company’s terms and conditions. “The Company”, “Ourselves”, “We”, “Our” and “Us”, refers to our Company. “Party”, “Parties”, or “Us”, refers to both the Client and us. All terms refer to the offer, acceptance and consideration of payment necessary to undertake the process of our assistance to the Client in the most appropriate manner for the express purpose of meeting the Client’s needs in respect of provision of the Company’s stated services, in accordance with and subject to, prevailing law of Australia. Any use of the above terminology or other words in the singular, plural, capitalization and/or he/she or they, are taken as interchangeable and therefore as referring to same.
            </p>
          </div>

          {/* Order Policy */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Order Policy</h2>
            <p>
              Orders will be processed for printing during working hours from 9 Am – 5 Pm from Mon. – Fri. For the Priority Despatch orders, the orders should be placed before 3 Pm and will be despatched next day. Logistics delay may occur as it is not under the control of Erry Imprints team. Priority despatch refers to priority production but not express freight.
            </p>
          </div>

          {/* Dispatch */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Dispatch</h2>
            <p>
              The orders will be dispatched within minimum frame of 5-7 working days. Saturdays and Sundays will not be considered in working days. Dispatch delays can happen due to unavoidable circumstances that relates to natural calamities, government policies or regulations, but the customers will be informed via email for the same. We will try our best to dispatch the order as quick as possible. For order updates, customers can contact us via email at info@erryimprints.com.au
            </p>
          </div>

          {/* Cookies */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Cookies</h2>
            <p>
              We employ the use of cookies. By accessing Erry Imprints, you agreed to use cookies in agreement with the Erry Imprints’s Privacy Policy.
            </p>
            <p>
              Most interactive websites use cookies to let us retrieve the user’s details for each visit. Cookies are used by our website to enable the functionality of certain areas to make it easier for people visiting our website. Some of our affiliate/advertising partners may also use cookies.
            </p>
          </div>

          {/* License */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">License</h2>
            <p>
              Unless otherwise stated, Erry Imprints and/or its licensors own the intellectual property rights for all material on Erry Imprints. All intellectual property rights are reserved. You may access this from Erry Imprints for your own personal use subjected to restrictions set in these terms and conditions.
            </p>
            <p>You must not:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Republish material from Erry Imprints</li>
              <li>Sell, rent or sub-license material from Erry Imprints</li>
              <li>Reproduce, duplicate, or copy material from Erry Imprints</li>
              <li>Redistribute content from Erry Imprints</li>
            </ul>
            <p className="pt-2">
              Parts of this website offer an opportunity for users to post and exchange opinions and information in certain areas of the website. Erry Imprints does not filter, edit, publish, or review Comments prior to their presence on the website. Comments do not reflect the views and opinions of Erry Imprints, its agents and/or affiliates. Comments reflect the views and opinions of the person who post their views and opinions. To the extent permitted by applicable laws, Erry Imprints shall not be liable for the Comments or for any liability, damages or expenses caused and/or suffered as a result of any use of and/or posting of and/or appearance of the Comments on this website.
            </p>
            <p>
              Erry Imprints reserves the right to monitor all Comments and to remove any Comments which can be considered inappropriate, offensive or causes breach of these Terms and Conditions.
            </p>
            <p>You warrant and represent that:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>You are entitled to post the Comments on our website and have all necessary licenses and consents to do so.</li>
              <li>The Comments do not invade any intellectual property right, including without limitation copyright, patent, or trademark of any third party.</li>
              <li>The Comments do not contain any defamatory, libellous, offensive, indecent, or otherwise unlawful material which is an invasion of privacy</li>
              <li>The Comments will not be used to solicit or promote business or custom or present commercial activities or unlawful activity.</li>
            </ul>
            <p className="pt-2">
              You hereby grant Erry Imprints a non-exclusive license to use, reproduce, edit, and authorize others to use, reproduce and edit any of your Comments in all forms, formats or media.
            </p>
          </div>

          {/* Hyperlinking to our Content */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Hyperlinking to our Content</h2>
            <p>
              The following organizations may link to our Website without prior written approval:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Government agencies.</li>
              <li>Search engines.</li>
              <li>News organizations.</li>
              <li>Online directory distributors may link to our Website in the same manner as they hyperlink to the Websites of other listed businesses; and</li>
              <li>System wide Accredited Businesses except soliciting non-profit organizations, charity shopping malls, and charity fundraising groups which may not hyperlink to our Web site.</li>
            </ul>
            <p className="pt-2">
              These organizations may link to our home page, to publications or to other Website information so long as the link: (a) is not in any way deceptive; (b) does not falsely imply sponsorship, endorsement or approval of the linking party and its products and/or services; and (c) fits within the context of the linking party’s site.
            </p>
            <p>
              We may consider and approve other link requests from the following types of organizations:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>commonly known consumer and/or business information sources.</li>
              <li>dot.com community sites.</li>
              <li>associations or other groups representing charities.</li>
              <li>online directory distributors.</li>
              <li>internet portals.</li>
              <li>accounting, law, and consulting firms and</li>
              <li>educational institutions and trade associations.</li>
            </ul>
            <p className="pt-2">
              We will approve link requests from these organizations if we decide that: (a) the link would not make us look unfavourably to ourselves or to our accredited businesses; (b) the organization does not have any negative records with us; (c) the benefit to us from the visibility of the hyperlink compensates the absence of Erry Imprints; and (d) the link is in the context of general resource information.
            </p>
            <p>
              These organizations may link to our home page so long as the link: (a) is not in any way deceptive; (b) does not falsely imply sponsorship, endorsement or approval of the linking party and its products or services; and (c) fits within the context of the linking party’s site.
            </p>
            <p>
              If you are one of the organizations listed in paragraph 2 above and are interested in linking to our website, you must inform us by sending an e-mail to Erry Imprints. Please include your name, your organization name, contact information as well as the URL of your site, a list of any URLs from which you intend to link to our Website, and a list of the URLs on our site to which you would like to link. Wait 2-3 weeks for a response.
            </p>
            <p>
              Approved organizations may hyperlink to our Website as follows:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>By use of our corporate name; or</li>
              <li>By use of the uniform resource locator being linked to; or</li>
              <li>By use of any other description of our Website being linked to that makes sense within the context and format of content on the linking party’s site.</li>
            </ul>
            <p className="pt-2">
              No use of Erry Imprints’s logo or other artwork will be allowed for linking absent a trademark license agreement.
            </p>
          </div>

          {/* iFrames */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">iFrames</h2>
            <p>
              Without prior approval and written permission, you may not create frames around our Webpages that alter in any way the visual presentation or appearance of our Website.
            </p>
          </div>

          {/* Content Liability */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Content Liability</h2>
            <p>
              We shall not be hold responsible for any content that appears on your Website. You agree to protect and defend us against all claims that is rising on your Website. No link(s) should appear on any Website that may be interpreted as libellous, obscene or criminal, or which infringes, otherwise violates, or advocates the infringement or other violation of, any third-party rights.
            </p>
          </div>

          {/* Your Privacy */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Your Privacy</h2>
            <p>
              Please read <Link href="/privacy" className="text-blue-600 hover:underline font-semibold">Privacy Policy</Link>
            </p>
          </div>

          {/* Reservation of Rights */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Reservation of Rights</h2>
            <p>
              We reserve the right to request that you remove all links or any particular link to our Website. You approve to immediately remove all links to our Website upon request. We also reserve the right to amen these terms and conditions and it is linking policy at any time. By continuously linking to our Website, you agree to be bound to and follow these linking terms and conditions.
            </p>
          </div>

          {/* Removal of links from our website */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Removal of links from our website</h2>
            <p>
              If you find any link on our Website that is offensive for any reason, you are free to contact and inform us any moment. We will consider requests to remove links, but we are not obligated to or so or to respond to you directly.
            </p>
            <p>
              We do not ensure that the information on this website is correct, we do not warrant its completeness or accuracy; nor do we promise to ensure that the website remains available or that the material on the website is kept up to date.
            </p>
          </div>

          {/* Disclaimer */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Disclaimer</h2>
            <p>
              To the maximum extent permitted by applicable law, we exclude all representations, warranties and conditions relating to our website and the use of this website. Nothing in this disclaimer will:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>limit or exclude our or your liability for death or personal injury.</li>
              <li>limit or exclude our or your liability for fraud or fraudulent misrepresentation.</li>
              <li>limit any of our or your liabilities in any way that is not permitted under applicable law or</li>
              <li>exclude any of our or your liabilities that may not be excluded under applicable law.</li>
            </ul>
            <p className="pt-2">
              The limitations and prohibitions of liability set in this Section and elsewhere in this disclaimer: (a) are subject to the preceding paragraph; and (b) govern all liabilities arising under the disclaimer, including liabilities arising in contract, in tort and for breach of statutory duty.
            </p>
            <p>
              As long as the website and the information and services on the website are provided free of charge, we will not be liable for any loss or damage of any nature.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
